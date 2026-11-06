# Tuần 9 – TV2 (Thanh): ma trận phân quyền, threat model, chốt BR-06

Vai trò: mô tả **ai được làm gì với dữ liệu nào** (ma trận phân quyền) và **cái gì có thể bị tấn công** (threat model) từ góc
nhìn nghiệp vụ; chốt các điểm nghiệp vụ còn mở từ tuần 8. TV1 dùng ma trận để viết e2e test, TV4 dùng để viết ca kiểm thử.

Bản đối chiếu UC1/UC2 tuần 8 (`docs/business/uc1-uc2-review-draft.md`) làm rất tốt ở chỗ dẫn chứng code cụ thể và tách điểm đã
xác nhận với điểm cần làm rõ. Tuần này giữ cách làm đó.

## Hạn chót

| Hạn | Việc |
|---|---|
| **T3 (3/11), 21:00** | Gửi link nhánh `docs/week8-tv2-report` đã sửa (xem cuối mục "Cách làm trên git") |
| **T4 (4/11), 21:00** | Gửi link nhánh `docs/access-control-matrix` |
| T5 (5/11) | Sửa theo góp ý, mở PR, được merge (TV1 và TV4 cần để viết test) |
| **T5 (5/11), 21:00** | Gửi link nhánh `docs/leave-rules-br06` (chốt issue #21, #22, BR-06) |
| T6 (6/11) | Sửa theo góp ý, mở PR, được merge |
| **T6 (6/11), 21:00** | Gửi link nhánh `docs/threat-model` |
| T7 (7/11) | Sửa theo góp ý, mở PR, được merge |
| Trong 24 giờ kể từ khi nhận link | Review nghiệp vụ nhánh `test/access-control-e2e` của TV1 và `docs/security-test-cases` của TV4 |
| **T2 (9/11), 9:00** | Điền mục "Việc đã làm" ở cuối file này |

**Review phải để lại dấu vết:** tuần 8 trên GitHub không có review nào của TV2 cho PR của TV1. Tuần này góp ý gửi trong nhóm
chat sẽ được TV1 ghi vào mục "Góp ý review" của người được review, kèm tên người góp ý. Mục "Việc đã làm" chỉ ghi review đã
có dấu vết đó.

## Việc cần làm

### 1. `docs/access-control-matrix` – ma trận phân quyền (RBAC + ABAC)

Output: `docs/security/access-control-matrix.md` (tạo thư mục `docs/security/`).

1. Liệt kê tài nguyên và thao tác từ API hiện có: `docs/openapi.yaml` hoặc Swagger (http://localhost:3000/api/docs khi chạy
   `docker compose up`). Nhóm theo module: Hồ sơ nhân viên, Trường nhạy cảm, Tổ chức, Nghỉ phép, Audit log.
2. Với mỗi thao tác, ghi quyền của 4 vai trò `EMPLOYEE`, `MANAGER`, `HR`, `ADMIN` và **điều kiện theo dữ liệu** (phần ABAC), ví
   dụ "chỉ hồ sơ của mình", "chỉ nhân viên trực tiếp", "đơn ở trạng thái SUBMITTED". Ví dụ:

   | Tài nguyên | Thao tác | API | EMPLOYEE | MANAGER | HR | ADMIN | Nguồn |
   |---|---|---|---|---|---|---|---|
   | Đơn nghỉ phép | Duyệt | `POST /leave-requests/{id}/approve` | ✗ | ✓ nếu là quản lý trực tiếp của người tạo đơn và đơn đang `SUBMITTED` | ✗ | ✗ | BR-05 |
   | Hồ sơ | Xem trường nhạy cảm | `GET /employees/{id}?include=sensitive` | ✗ | ✗ | ✓ (ghi audit) | ✗ | UC1.3, ADR-08 |

3. Cột "Nguồn": FR tuần 5, BR trong `leave-rules.md`, ADR, hoặc "chỉ có trong code" (code làm nhưng chưa có yêu cầu nào nói).
4. Đối chiếu với code (`@Roles(...)` trong `*.controller.ts`, kiểm tra theo dữ liệu trong `*.service.ts`, `employee-access.ts`,
   `leave-state-machine.ts`). Chỗ nào code khác ma trận thì ghi ở mục "Điểm lệch" cuối file, không tự kết luận là lỗi code
   hay lỗi yêu cầu.
5. Thêm mục ngắn "Nguyên tắc": deny by default; phân quyền hai lớp (role ở controller, dữ liệu ở service); ADMIN là quản trị
   kỹ thuật, không xem dữ liệu nhân sự.

Xong khi: mọi endpoint trong `openapi.yaml` có dòng trong ma trận; mỗi ô ✓ có điều kiện rõ ràng để TV4 viết được ca kiểm thử.

### 2. `docs/leave-rules-br06` – chốt issue #21, #22 và BR-06

1. **Issue #22 (quy tắc quản lý trực tiếp):** chọn một phương án, ghi lý do: ví dụ "chỉ nhân viên đứng đầu (Tổng giám đốc)
   được không có quản lý; đơn nghỉ của người này do HR duyệt" hoặc phương án khác.
2. **BR-06 (người duyệt thay):** mô tả mô hình dữ liệu ở mức nghiệp vụ: ai được giao thay (HR ghi nhận), từ ngày nào đến ngày
   nào, người duyệt thay thấy đơn ở đâu, khi người duyệt thay cũng vắng thì sao. Cập nhật BR-06 trong
   `docs/business/leave-rules.md` và mục "Đối chiếu với hiện thực".
3. **Issue #21 (tra cây theo mã phòng ban):** chọn bổ sung API hay sửa FR.
4. Comment quyết định vào từng issue; TV1 đóng issue khi code xong (hoặc đóng ngay nếu chỉ sửa FR).

### 3. `docs/threat-model` – threat model STRIDE

Output: `docs/security/threat-model.md`.

1. Sơ đồ luồng dữ liệu (Mermaid) gồm: trình duyệt, Keycloak/Cognito, API, PostgreSQL, RabbitMQ/SQS, worker, Mailpit/SMTP. Vẽ
   ranh giới tin cậy (internet ↔ API, API ↔ DB, API ↔ queue).
2. Với 3 luồng: đăng nhập, xem/sửa hồ sơ (có trường nhạy cảm), nghỉ phép (tạo → duyệt → hoàn tất → email), liệt kê mối đe
   dọa theo 6 nhóm STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of
   privilege). Mỗi dòng: mã `T-01…`, luồng, nhóm STRIDE, mô tả, tài sản bị ảnh hưởng, biện pháp đã có (dẫn file/ADR),
   khoảng trống còn lại, mức độ (cao/trung bình/thấp), người xử lý đề xuất.
3. Ví dụ để bắt đầu: nhân viên sửa `version` hoặc `employeeId` trong request (Tampering → đã chặn bằng kiểm tra ở service);
   quản lý duyệt đơn của người không thuộc quyền (Elevation → BR-05); email lộ thông tin nghỉ ốm (Information disclosure);
   gửi lặp tạo đơn (Tampering/DoS → `Idempotency-Key`).
4. Mục cuối "Việc cần làm tiếp": các khoảng trống mức cao, đề xuất đưa vào tuần 10.

## Cách làm trên git (quy trình mới)

```bash
git checkout dev && git pull
git checkout -b docs/access-control-matrix
# viết file, rồi:
git add docs/security/access-control-matrix.md
git commit -m "docs(security): add access control matrix"
git push -u origin docs/access-control-matrix
```

Sau đó **chưa mở PR**: gửi link
`https://github.com/Acerchicken/HR-Enterprise-Platform/compare/dev...docs/access-control-matrix` vào nhóm chat. Đợi góp ý ở
mục "Góp ý review" bên dưới, sửa trên cùng nhánh, hết góp ý "cần sửa" thì `git pull origin dev`, rồi mới mở PR vào `dev`.

**Việc tồn tuần 8:** nhánh `docs/week8-tv2-report` (mục "Việc đã làm" của `tuan-08/TV2_Thanh.md`) chưa vào `dev`. Sửa trên
chính nhánh đó: bỏ 2 dòng ghi đã review PR của TV1 (API, outbox, giao diện) và PR ca kiểm thử của TV4, vì trên GitHub không có
review nào của TV2 và lúc đó PR outbox, giao diện chưa tồn tại; chạy `git pull origin dev` rồi gửi link review trước **T3 (3/11),
21:00**.

## Góp ý review

_TV1 ghi góp ý vào đây trước khi bạn mở PR. Mỗi dòng: ngày, nhánh, người góp ý, nội dung ("cần sửa" hoặc "nit:"), trạng thái._

| Ngày | Nhánh | Người góp ý | Góp ý | Trạng thái |
|---|---|---|---|---|
| 5/11 | `docs/week8-tv2-report` | TV1 | Đạt: đã bỏ 2 dòng review không có dấu vết, gửi đúng hạn 3/11. Mở PR được | Chờ mở PR |
| 5/11 | `docs/access-control-matrix` | TV1 | Đạt, gửi đúng hạn 4/11: phủ 27/27 operation, đối chiếu `@Roles` và service chính xác (TV1 đã kiểm từng controller). Mở PR được | Chờ mở PR |
| 5/11 | `docs/access-control-matrix` | TV1 | Trả lời câu hỏi 1–3 ở mục "Điểm lệch": TV1 đề xuất **giữ nguyên** (danh bạ, cấp dưới trực tiếp, thành viên phòng ban, danh mục tổ chức/loại phép/ngày lễ mở cho mọi người đã đăng nhập theo UC2, UC6). Ghi vào ma trận là quyết định có chủ ý thay vì "cần xác nhận" | Chờ sửa |
| 5/11 | `docs/access-control-matrix` | TV1 | nit: sau khi `docs/leave-rules-br06` merge, sửa dòng Duyệt/Từ chối: "HR nếu chủ đơn là CEO" và người duyệt thay theo BR-06 (ghi là chưa có trong code) | Chờ sửa |
| 5/11 | `docs/leave-rules-br06` | TV1 | Đạt, gửi đúng hạn 5/11: quyết định #21, #22, BR-06 rõ, khớp seed (có đúng một nhân viên chức danh `CEO`, không có quản lý). Mở PR được | Chờ mở PR |
| 5/11 | `docs/leave-rules-br06` | TV1 | nit: file `tuan-05/TV2_Thanh.md` là báo cáo tuần 5; thêm một dòng ghi chú dưới bảng FR "Cập nhật 5/11/2026 theo issue #21, #22" để người đọc biết FR đã đổi | Chờ sửa |
| 5/11 | `docs/leave-rules-br06` | TV1 (theo quyết định của Duong) | **Cần thêm BR-12 – Tạo đơn hộ nhân viên** trên cùng nhánh: (1) HR tạo hộ được cho mọi nhân viên; quản lý chỉ tạo hộ được cho cấp dưới trực tiếp của mình (và nhân viên mình đang duyệt thay theo BR-06 nếu thấy hợp lý, ghi rõ); (2) đơn tạo hộ áp dụng đủ BR-01 → BR-04, chủ đơn và số dư là của nhân viên, không phải của người tạo; (3) đơn vẫn đi qua quản lý trực tiếp duyệt bình thường (BR-05, BR-06), kể cả khi người tạo hộ chính là quản lý đó: ghi rõ đây là trade-off chấp nhận, bù lại bằng lịch sử/audit ghi người tạo hộ khác chủ đơn; (4) nhân viên nhận email khi có đơn tạo hộ và vẫn tự hủy được khi đơn còn `SUBMITTED` (BR-07); (5) lịch sử và audit ghi \"người tạo\" và \"chủ đơn\" riêng. Cập nhật sơ đồ quy trình, mục \"Đối chiếu với hiện thực\" (chưa có trong code, TV1 làm tuần 10) và dòng \"Đơn nghỉ phép – Tạo\" trong ma trận phân quyền | Chưa sửa |
| 5/11 | `docs/leave-rules-br06` | TV1 | Sau khi merge: comment quyết định vào issue #21 (đóng luôn vì chỉ sửa FR) và #22 (để mở, TV1 code tuần 10) | Chờ làm |

## Việc đã làm

_Điền T2 (9/11), 9:00._
