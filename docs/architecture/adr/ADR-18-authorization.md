# ADR-18 – Phân quyền: RBAC ở controller, kiểm theo dữ liệu ở service, vai trò lấy từ database của ứng dụng

| Mục | Nội dung |
|---|---|
| Trạng thái | Đề xuất (Duong chọn nguồn vai trò ngày 17/11/2026) |
| Ngày quyết định | Ngày merge PR |
| Thời điểm | Tuần 11 (16/11 – 22/11/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Phần mềm |
| ADR liên quan | ADR-10, ADR-08, ADR-09, ADR-13, ADR-14, ADR-17 |
| Yêu cầu liên quan | NFR-5.10 → NFR-5.13, FR-8.x (SRS); threat model T-03, T-06 |

## Lịch sử thay đổi

- 17/11/2026: bản đề xuất đầu tiên. Hướng dẫn làm theo: [`docs/security/authorization.md`](../../security/authorization.md).
  Hợp đồng từng API vẫn là [ma trận phân quyền](../../security/access-control-matrix.md).

## Nội dung quyết định

**Bối cảnh:**

Xác thực (ai đang gọi) do identity provider lo theo [ADR-17](ADR-17-authentication.md). Phân quyền (người đó được làm gì, trên bản
ghi nào) chạy trong API. Code trên `dev` (17/11/2026) đã làm hai lớp nhưng chưa có quyết định nào ghi lại cách làm:

- `AuthGuard` toàn cục và `@Roles(...)` ở 25 chỗ trong controller.
- Hàm thuần kiểm theo dữ liệu: `employee-access.ts` (`viewLevel`, `forbiddenFields`), `document-rules.ts` (`canView`), điều kiện
  quản lý trực tiếp trong `LeaveService`.

Nhiều quy tắc nghiệp vụ không diễn tả được bằng vai trò: "quản lý chỉ duyệt đơn của cấp dưới trực tiếp" (BR-05), "nhân viên chỉ xem
hồ sơ của mình", "ADMIN không xem trường nhạy cảm" (ADR-08), "tài liệu theo phạm vi đơn vị" (ADR-13). RBAC thuần không đủ.

Rà code thấy thêm:

| # | Vấn đề | Ảnh hưởng |
|---|---|---|
| 1 | Vai trò lấy từ **hai nguồn**: claim của token (`realm_access.roles`, `cognito:groups`) và bảng `iam.role_assignment`; kết quả là hợp của hai bên | Không trả lời được "ai cấp HR cho người này, lúc nào" (T-03, T-06); hai nơi dễ lệch |
| 2 | Keycloak có realm role `manager`, Cognito có nhóm `manager` | Trái ADR-10: MANAGER phải suy ra từ sơ đồ tổ chức, không cấp tay |
| 3 | `GET /employees/{id}/direct-reports`, `GET /departments/{id}/members` chỉ cần đăng nhập, không kiểm người gọi | Ai cũng liệt kê được cấp dưới, thành viên của bất kỳ ai (đúng với danh bạ, nhưng chưa có quyết định) |
| 4 | Cột `iam.role_assignment.scope_department_id` có nhưng không dùng | Thiết kế HR theo phạm vi bị bỏ dở |
| 5 | Chưa có màn hình, API cấp và thu hồi vai trò; chưa ghi audit | NFR-5.10 chưa đạt |

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | RBAC thuần | Mỗi vai trò một tập quyền; mọi quy tắc theo bản ghi bỏ hoặc gộp vào vai trò mới (ví dụ `MANAGER_OF_X`) |
| B | RBAC + kiểm theo dữ liệu bằng hàm thuần trong từng module | Giữ cách đang làm và viết thành quy ước: vai trò chặn ở controller; quan hệ (chủ bản ghi, quản lý trực tiếp, phạm vi đơn vị) kiểm ở service bằng hàm thuần có unit test; danh sách lọc ngay trong truy vấn |
| C | Policy engine riêng | Viết chính sách bằng ngôn ngữ riêng: Casbin trong process, OPA chạy sidecar, hoặc Amazon Verified Permissions (Cedar) |

**Tiêu chí lựa chọn** (điểm 1–5, không trọng số):

| Tiêu chí | A | B | C |
|---|---|---|---|
| Diễn tả đủ quy tắc nghiệp vụ (BR-05, ADR-08, ADR-13) | 1 | 5 | 5 |
| Công sức trước 2/12 với code đã có | 2 | 5 | 2 |
| Dễ kiểm thử (unit test không cần hạ tầng) | 4 | 5 | 3 |
| Lọc danh sách ngay trong SQL (phân trang đúng, không rò số lượng) | 3 | 5 | 2 |
| Độ trễ và chi phí mỗi request | 5 | 5 | 3 |
| Tách chính sách khỏi code, dễ trình bày khi bảo vệ | 3 | 3 | 5 |
| **Tổng điểm** | **18** | **28** | **20** |

C hợp khi chính sách đổi thường xuyên hoặc nhiều ứng dụng dùng chung. Ở đây một API, chính sách gắn chặt với dữ liệu (cây đơn vị,
quan hệ quản lý), và lọc danh sách phải nằm trong SQL. Verified Permissions còn tính tiền theo số lần kiểm và thêm một lần gọi mạng
cho mỗi request.

**Giải pháp được chọn:** B, kèm các quyết định con:

1. **Bốn vai trò, hai loại.**
   - `EMPLOYEE`, `MANAGER` **suy ra** lúc mỗi request: có hồ sơ chưa nghỉ việc thì là `EMPLOYEE`; có cấp dưới trực tiếp thì là
     `MANAGER` (ADR-10). Không ai cấp tay.
   - `HR`, `ADMIN` **được cấp** và lưu ở `iam.role_assignment`.
2. **Nguồn chính là database của ứng dụng** (Duong chọn 17/11/2026).
   - API **không đọc vai trò từ claim của token nữa**; token chỉ dùng để biết là ai (`sub`, email).
   - ADMIN cấp và thu hồi `HR`, `ADMIN` trong ứng dụng; mỗi lần ghi audit `ROLE_GRANT`, `ROLE_REVOKE` trong cùng giao dịch
     (ADR-09) và event `role.granted`, `role.revoked` vào outbox.
   - Consumer `identity-sync` (ADR-17 mục 4) đồng bộ sang nhóm trên IdP (`AdminAddUserToGroup`, `AdminRemoveUserFromGroup`;
     Keycloak gán realm role). Nhóm trên IdP chỉ để IdP bắt MFA theo vai trò, không quyết định quyền.
   - Bỏ realm role và nhóm `manager` trên Keycloak, Cognito.
   - Ràng buộc: không tự cấp, tự thu hồi vai trò của chính mình; luôn còn ít nhất một ADMIN đang hoạt động; ADMIN đầu tiên tạo bằng
     seed hoặc lệnh `npm run grant-admin -- <email>` chạy tay một lần.
3. **Ba lớp kiểm, theo thứ tự:**
   - **Lớp 1, controller:** `AuthGuard` toàn cục (mặc định từ chối) và `@Roles(...)` cho thao tác chỉ một số vai trò được làm.
   - **Lớp 2, service:** hàm thuần trong file `<module>-access.ts` nhận `AuthUser` và bản ghi, trả quyết định. Mọi điều kiện
     theo chủ bản ghi, quan hệ quản lý, phạm vi đơn vị nằm ở đây.
   - **Lớp 3, truy vấn:** API danh sách lọc trong câu SQL theo cùng quy tắc, không lấy hết rồi lọc trong bộ nhớ.
4. **403 hay 404.** Không có quyền trên một bản ghi mà người gọi không được biết là có tồn tại (hồ sơ người khác ở mức riêng tư, tài
   liệu ngoài phạm vi, file hồ sơ) thì trả **404**. Biết là có nhưng không được làm thao tác (duyệt đơn không phải của cấp dưới) thì
   trả **403**. Ghi rõ ở cột "Điều kiện" của ma trận.
5. **Danh bạ mở cho mọi nhân viên** ở mức danh bạ (tên, email, điện thoại công việc, đơn vị, chức danh, quản lý). Vì vậy
   `direct-reports` và `members` giữ mở nhưng chỉ trả trường mức danh bạ; ghi rõ vào ma trận thay vì để "hiện không kiểm".
6. **HR toàn công ty ở version 1.** Cột `scope_department_id` giữ lại, không dùng; HR theo phạm vi đơn vị là hướng mở rộng.
7. **Giao diện chỉ ẩn nút cho gọn**, không phải lớp bảo vệ. API vẫn kiểm đủ (NFR-5.12).

**Trade-off:**

- Chính sách nằm rải trong code của từng module, không có một file chính sách duy nhất để đọc. Giảm thiểu: quy ước tên
  `<module>-access.ts`, ma trận phân quyền là bản tổng hợp, và mỗi dòng ma trận có test.
- Mỗi request tra database để lấy vai trò và quan hệ quản lý (2 truy vấn nhỏ có chỉ mục). Chấp nhận ở 50 RPS (ADR-06); nếu cần thì
  cache theo `userId` 30 giây (ADR-07 không dùng Redis, cache trong bộ nhớ là đủ).
- Thu hồi vai trò có hiệu lực ngay ở API (đọc database mỗi request); nhóm trên IdP chậm vài giây, chỉ ảnh hưởng việc IdP có hỏi
  MFA hay không.

**Tiêu chí nghiệm thu:**

- `IdentityService.resolve` không đọc `token.roles`; test: token có nhóm `hr` nhưng database không có thì không có quyền HR.
- Keycloak và Cognito không còn `manager`.
- ADMIN cấp, thu hồi `HR`, `ADMIN` qua API; có audit `ROLE_GRANT`, `ROLE_REVOKE`; tự cấp cho mình bị 403; thu hồi ADMIN cuối cùng bị 409.
- Mọi dòng trong [ma trận phân quyền](../../security/access-control-matrix.md) có e2e hoặc ca kiểm thử bảo mật; không còn ghi chú
  "hiện không kiểm" mà không có quyết định.

**Khi nào xem lại:**

- Cần HR theo phạm vi đơn vị, hoặc vai trò mới (kế toán, trưởng đơn vị có quyền riêng theo ADR-14).
- Có thêm ứng dụng khác dùng chung chính sách: cân nhắc phương án C.
- Kiểm quyền chiếm hơn 10% thời gian xử lý request.
