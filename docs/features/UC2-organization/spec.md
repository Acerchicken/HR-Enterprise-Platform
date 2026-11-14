# UC2 – Thông tin tổ chức

| Mục | Nội dung |
|---|---|
| Mục tiêu kinh doanh | MT-1 (hồ sơ và tổ chức tập trung, đúng một quản lý trực tiếp) |
| Tác nhân chính | Mọi người dùng đã đăng nhập (xem); HR, ADMIN (quản lý phòng ban); HR (chức danh, điều chuyển, trưởng/phó phòng) |
| Tác nhân phụ, hệ thống ngoài | Module Identity (suy ra vai trò MANAGER từ quan hệ quản lý, ADR-10) |
| Yêu cầu (SRS) | FR-2.1 → FR-2.9 |
| Quy tắc | Issue #21 (xem toàn bộ cây, không tra theo mã), issue #22 (một quản lý trừ CEO), ADR-10 |
| Mức ưu tiên | M (FR-2.4, FR-2.6 → FR-2.9 là S) |
| Trạng thái | Đã có; tạo, sửa phòng ban mới có API, chưa có giao diện |
| Phiên bản | 1.1 – 14/11/2026 (thêm chức danh, điều chuyển có ngày hiệu lực, quá trình công tác, trưởng/phó phòng) |

## 1. Mô tả ngắn

Mọi người dùng xem được danh bạ, sơ đồ tổ chức, thành viên từng phòng ban, quản lý trực tiếp và cấp dưới của một người. Đây là
danh bạ nội bộ có chủ ý: mọi tài khoản đã đăng nhập đều xem được, nhưng không bao giờ thấy trường nhạy cảm. HR và ADMIN
tạo, sửa phòng ban. HR quản lý danh mục chức danh, gán trưởng phòng và phó phòng, điều chuyển nhân viên từ một ngày hiệu lực;
mỗi lần điều chuyển thành một dòng trong quá trình công tác. Quan hệ quản lý trực tiếp quyết định ai duyệt đơn nghỉ (UC4) và
ai có vai trò MANAGER; trưởng, phó phòng là vai trò của phòng ban, không tự cho quyền duyệt.

## 2. Tác nhân và quyền

| Tác nhân | Được làm gì | Giới hạn theo dữ liệu |
|---|---|---|
| Mọi người dùng đã đăng nhập | Tìm danh bạ; xem cây tổ chức, chi tiết và thành viên phòng ban, chức danh, quản lý trực tiếp, cấp dưới | Không thấy nhân viên `TERMINATED`; chỉ trường danh bạ |
| HR, ADMIN | Thêm: tạo, sửa phòng ban (tên, mã, văn phòng, phòng ban cha, trưởng đơn vị) | Không tạo vòng trong cây phòng ban |
| HR | Gán quản lý trực tiếp khi tạo, sửa hồ sơ (UC1); điều chuyển; quản lý chức danh; gán trưởng, phó phòng | Đúng một quản lý đang làm việc, trừ CEO; trưởng, phó phòng thuộc chính phòng đó |
| Chủ hồ sơ, quản lý trực tiếp | Xem quá trình công tác của mình, của cấp dưới trực tiếp | – |

## 3. Điều kiện

- **Điều kiện trước:** người dùng đã đăng nhập; cây tổ chức có đúng một gốc (CEO).
- **Kích hoạt:** mở "Danh bạ" hoặc "Sơ đồ tổ chức"; HR, ADMIN tạo hoặc sửa phòng ban.
- **Điều kiện sau khi thành công (sửa phòng ban):**
  - Cây phòng ban vẫn có một gốc, không có vòng.
  - Có audit `CREATE` hoặc `UPDATE` với `entityType = department`.
  - Cache dữ liệu tham chiếu được xóa (ADR-07).
- **Điều kiện sau khi thất bại:** cây phòng ban giữ nguyên.

## 4. Luồng chính

### 4.1 Tìm đồng nghiệp trong danh bạ (FR-2.1)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Người dùng mở "Danh bạ", nhập tên, email hoặc mã; có thể chọn phòng ban | Gọi `GET /employees?q=&dept=&page=&size=` |
| 2 | | Lọc nhân viên khác `TERMINATED`, tìm theo tên, email, mã; sắp xếp ổn định; tối đa 100 dòng mỗi trang |
| 3 | Xem danh sách, bấm vào một người | Mở hồ sơ ở mức danh bạ (UC1, luồng A1) |

### 4.2 Xem sơ đồ tổ chức (FR-2.2, FR-2.3)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Người dùng mở "Sơ đồ tổ chức" | Gọi `GET /departments/tree`, trả toàn bộ cây (một gốc) |
| 2 | Chọn một phòng ban | Gọi `GET /departments/{id}` và `GET /departments/{id}/members` (phân trang) |
| 3 | Chọn một nhân viên | Hiện quản lý trực tiếp (trong hồ sơ) và gọi `GET /employees/{id}/direct-reports` |

### 4.3 HR, ADMIN tạo hoặc sửa phòng ban (FR-2.4)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Nhập tên, mã, phòng ban cha, trưởng đơn vị | Gửi `POST /departments` hoặc `PATCH /departments/{id}` |
| 2 | | Kiểm vai trò HR hoặc ADMIN; phòng ban cha tồn tại; mã không trùng |
| 3 | | Khi đổi phòng ban cha: kiểm không tạo vòng |
| 4 | | Lưu, ghi audit, xóa cache dữ liệu tham chiếu |
| 5 | Thấy cây đã cập nhật | Trả phòng ban |

### 4.4 HR điều chuyển nhân viên (FR-2.7, FR-2.8)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | HR mở hồ sơ nhân viên, bấm "Điều chuyển"; chọn phòng ban, chức danh, quản lý mới (điền sẵn trưởng phòng mới), ngày hiệu lực, lý do | Gửi `POST /employees/{id}/transfers` |
| 2 | | Kiểm FR-2.5 với quản lý mới; ngày hiệu lực không trước ngày vào làm, không lùi quá 30 ngày; không có điều chuyển chưa hiệu lực khác của cùng người |
| 3 | | Hiệu lực hôm nay hoặc quá khứ: trong một giao dịch đóng dòng công tác cũ, mở dòng mới, đổi `department_id`, `position_id`, `manager_id`, ghi audit `TRANSFER`, event `EmployeeTransferred` |
| 4 | | Hiệu lực tương lai: lưu dòng "Sắp hiệu lực"; job chạy 00:00 giờ Việt Nam áp dụng như bước 3 (chạy lại không áp dụng hai lần) |
| 5 | Thấy quá trình công tác cập nhật | Đơn nghỉ `SUBMITTED` của người này tự sang quản lý mới vì quyền duyệt tính theo quản lý hiện tại (BR-05); worker gửi email chung cho quản lý mới |

### 4.5 HR gán trưởng phòng, phó phòng (FR-2.9)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | HR mở phòng ban, chọn trưởng phòng và tối đa 3 phó phòng trong danh sách thành viên | Gửi `PATCH /departments/{id}` với `headEmployeeId`, `deputyEmployeeIds` |
| 2 | | Kiểm từng người đang làm việc và thuộc phòng ban đó; lưu, ghi audit; không đổi quản lý trực tiếp của ai |

## 5. Luồng thay thế

- **A1 (4.1 bước 1):** không nhập từ khóa. Trả toàn bộ danh bạ có phân trang.
- **A2 (4.2 bước 3):** nhân viên là CEO. Không có quản lý trực tiếp; cấp dưới là các trưởng khối.
- **A3 (4.2 bước 1):** cần cây con theo mã phòng ban. Ngoài phạm vi theo quyết định issue #21; dùng chi tiết phòng ban bằng UUID.

## 6. Ngoại lệ

| Mã | Tình huống | Hệ thống phản hồi |
|---|---|---|
| E1 | Chưa đăng nhập | 401 `UNAUTHENTICATED` |
| E2 | Nhân viên, quản lý tạo hoặc sửa phòng ban | 403 `FORBIDDEN` |
| E3 | Đổi phòng ban cha tạo vòng, hoặc phòng ban cha không tồn tại | 400 `BAD_REQUEST` |
| E4 | Mã phòng ban đã tồn tại | 409 `CONFLICT` |
| E5 | Phòng ban hoặc nhân viên không tồn tại | 404 `NOT_FOUND` |
| E6 | `size` lớn hơn 100 | 400 `BAD_REQUEST` |
| E7 | Tạo phòng ban không có `parentId`, hoặc sửa `parentId` thành `null` (tạo gốc thứ hai) | 400 `BAD_REQUEST` |
| E8 | `headEmployeeId` hoặc phó phòng không phải nhân viên đang làm việc, hoặc không thuộc phòng ban đó | 400 `BAD_REQUEST` |
| E9 | Điều chuyển vi phạm FR-2.5, hiệu lực trước ngày vào làm hoặc lùi quá 30 ngày | 400 `BAD_REQUEST` |
| E10 | Đã có điều chuyển chưa hiệu lực cho cùng người | 409 `CONFLICT`; hủy điều chuyển cũ trước |
| E11 | Xóa chức danh đang được dùng hoặc có trong lịch sử | 409 `CONFLICT`; chỉ ngừng dùng được |

## 7. Quy tắc áp dụng

- **Một quản lý trực tiếp (FR-2.5, issue #22):** chỉ người giữ chức danh CEO được không có quản lý và là gốc duy nhất. Mọi
  người khác có đúng một quản lý đang làm việc. Kiểm khi tạo, sửa hồ sơ (UC1 luồng 4.2, 4.3).
- **Xem toàn bộ cây (issue #21):** không tra cây theo mã phòng ban.
- **Danh bạ mở cho mọi tài khoản đã đăng nhập:** quyết định có chủ ý, ghi ở
  [ma trận phân quyền – Điểm lệch và quyết định](../../security/access-control-matrix.md#điểm-lệch-và-quyết-định-nghiệp-vụ).
- [ADR-10](../../architecture/adr/ADR-10-manager-role-derived.md): người có ít nhất một cấp dưới đang làm việc có vai trò MANAGER.
- [ADR-07](../../architecture/adr/ADR-07-no-redis.md): dữ liệu tham chiếu (phòng ban, chức danh) cache 10 phút trong bộ nhớ.

## 8. Dữ liệu vào

| Trường | Bắt buộc | Kiểm tra |
|---|---|---|
| `q` (danh bạ) | Không | Tìm trong tên, email, mã |
| `dept` (danh bạ) | Không | UUID phòng ban |
| `page`, `size` | Không | `size` tối đa 100 |
| `name`, `code` (phòng ban) | Có khi tạo | `code` gồm chữ in hoa, số, gạch ngang, 2–20 ký tự, duy nhất; không sửa sau khi tạo |
| `office` | Không | Văn phòng của phòng ban |
| `parentId` | Có, trừ phòng ban gốc đã có sẵn | Phòng ban tồn tại, không tạo vòng |
| `headEmployeeId` | Không | Nhân viên đang làm việc |

## 9. Giao diện và API

| Luồng | Màn hình | API |
|---|---|---|
| 4.1 | `/directory` | `GET /employees` |
| 4.2 | `/org` | `GET /departments/tree`, `GET /departments/{id}`, `GET /departments/{id}/members`, `GET /employees/{id}/direct-reports`, `GET /positions` |
| 4.3, 4.5 | Chưa có màn hình (`/org/manage`) | `POST /departments`, `PATCH /departments/{id}` |
| 4.4 | Nút "Điều chuyển" trong hồ sơ (chế độ HR); mục "Quá trình công tác" của popup hồ sơ (UC1) | `POST /employees/{id}/transfers`, `DELETE /employees/{id}/transfers/{transferId}` (hủy khi chưa hiệu lực), `GET /employees/{id}/profile/career-history` |
| FR-2.6 | `/org/positions` (HR) | `GET /positions`, `POST /positions`, `PATCH /positions/{id}` (tên, cấp bậc, `active`) |

## 10. Yêu cầu phi chức năng liên quan

- NFR-1.3: tìm đồng nghiệp p95 < 1 s với 2.000 nhân viên. NFR-1.6: phân trang tối đa 100 dòng.
- NFR-2.4: truy vấn vẫn nhanh khi tăng tới 10.000 nhân viên.
- NFR-5.21: giới hạn 20 request tìm kiếm mỗi phút cho mỗi người dùng (kế hoạch tuần 11), chống quét danh bạ (T-11).

## 11. Kiểm thử

Chiến lược, test đã có, bảng phủ tiêu chí và ca còn thiếu: [test.md](test.md). Cách triển khai: [deploy.md](deploy.md).

## 12. Hiện trạng và việc còn lại

| Nội dung | Trạng thái | Việc còn lại |
|---|---|---|
| Danh bạ, cây, thành viên, cấp dưới | Đã có | – |
| Quy tắc một quản lý, CEO | Đã có (PR #60, tuần 10) | – |
| Tạo, sửa phòng ban | Có API, chưa có giao diện | Làm giao diện nếu còn thời gian (mức S) |
| Ý nghĩa `headEmployeeId` và quan hệ với quản lý trực tiếp | Đã chốt 14/11 (FR-2.9, soạn thay TV2, chờ TV2 rà) | – |
| Trưởng, phó phòng (FR-2.9) | Chưa có: có cột `head_employee_id`, chưa có phó phòng, chưa kiểm thuộc phòng | TV1, tuần 13 |
| Danh mục chức danh (FR-2.6) | Chỉ có `GET /positions` và seed | TV1, tuần 13 |
| Điều chuyển, quá trình công tác (FR-2.7, FR-2.8) | Chưa có: sửa hồ sơ ghi đè phòng ban, quản lý, không giữ lịch sử | TV1, `feat/employee-transfer` tuần 13 |
| Gán quản lý đã nghỉ việc | Đã chặn (400, PR #60) | – |
| Chặn gốc thứ hai (E7), kiểm `headEmployeeId` (E8) | Code chưa có: API chấp nhận cả hai | TV1, `fix/employee-org-integrity` tuần 11 |
| Giải thể, sáp nhập phòng ban | Chưa có trong yêu cầu | TV2 quyết định có đưa vào không (thực tế có xảy ra; hiện chỉ đổi tên, đổi cha) |
| Audit phòng ban | Đã có | `changedFields` ghi giá trị mới (tên, mã, văn phòng, cha, trưởng đơn vị); không có dữ liệu cá nhân |

## 13. Thiết kế đề xuất cho phần chưa có

- **Bảng `org.employment_assignment`** (quá trình công tác): `id`, `employee_id`, `department_id`, `position_id`, `manager_id`,
  `effective_from`, `effective_to` (NULL = đang hiệu lực), `reason` (`HIRE`, `TRANSFER`, `PROMOTION`, `MANAGER_CHANGE`,
  `CORRECTION`), `note`, `status` (`SCHEDULED`, `ACTIVE`, `CLOSED`, `CANCELLED`), `created_by`, `created_at`. Mỗi người có đúng
  một dòng `ACTIVE` (unique index có điều kiện) và tối đa một dòng `SCHEDULED`. Chỉ thêm, không sửa nội dung dòng đã đóng.
- `employee.employee.department_id`, `position_id`, `manager_id` vẫn giữ, là **giá trị hiện tại** để mọi truy vấn cũ (danh bạ,
  quyền duyệt) không đổi; điều chuyển cập nhật cả hai trong một giao dịch.
- **Migration:** tạo dòng `HIRE` cho mọi nhân viên hiện có từ `hire_date` với phòng ban, chức danh, quản lý hiện tại.
- **Phó phòng:** bảng `org.department_deputy` (`department_id`, `employee_id`, `created_by`, `created_at`), tối đa 3 dòng mỗi
  phòng ban (kiểm ở service).
- **Chức danh:** thêm `org.position.active` (mặc định `true`); `level` 1–10.
- **Job áp dụng điều chuyển tương lai:** chạy trong worker mỗi ngày 00:05 giờ Việt Nam, lấy dòng `SCHEDULED` có
  `effective_from <= hôm nay`, áp dụng từng dòng trong một giao dịch, bỏ qua dòng đã áp dụng (idempotent).
