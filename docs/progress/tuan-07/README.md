# Tuần 7 (19/10 – 26/10) – Implementation 1: Nền tảng

Tuần 7 hoàn thành phần nền tảng theo kế hoạch: repo chạy được ở local, có đăng nhập OIDC qua Keycloak, module Employee,
Organization, Audit, dữ liệu mẫu 2,000 nhân viên và frontend gọi được API. Module Leave đã có data model và state machine,
API workflow làm ở tuần 8. Tech stack chốt trong ADR-04: **NestJS + React + PostgreSQL + Keycloak**.

## 1. Các công việc đã hoàn thành

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (nhóm trưởng) | Chốt tech stack (ADR-04); khung repo modular monolith, xử lý lỗi chung; quy ước code + quy trình PR; module Leave: entity + state machine | Khung repo, `docs/CONVENTIONS.md`, PR template, state machine + 9 unit test | [TV1.md](TV1.md) |
| TV2 | Migration đầu tiên (5 schema, 11 bảng); module Employee, Organization, Audit; mã hóa trường nhạy cảm; `docs/openapi.yaml` sinh từ code | 13 endpoint chạy local, migration, e2e test | [TV2.md](TV2.md) |
| TV3 | Khung frontend React + Vite; màn hình đăng nhập, hồ sơ, danh bạ, chi tiết nhân viên, sơ đồ tổ chức | Frontend chạy local, gọi được API | [TV3.md](TV3.md) |
| TV4 | docker-compose; realm Keycloak (4 role, 4 tài khoản demo); tích hợp OIDC; seed 2,000 nhân viên; hướng dẫn chạy | Chạy cả hệ thống bằng một lệnh, seed data | [TV4.md](TV4.md) |

**Chưa làm được theo kế hoạch:** map capability sang cloud service (vẫn chờ chốt provider), chuyển sang tuần 8.

**Kết quả kiểm thử:** 24 unit test và 18 e2e test đều qua; đã thử trên trình duyệt với Keycloak thật (đăng nhập, danh bạ,
xem trường nhạy cảm, sơ đồ tổ chức, sửa số điện thoại).

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 8: 26/10 – 2/11)

| Thành viên | Công việc | Output |
|---|---|---|
| TV1 (nhóm trưởng) | API workflow nghỉ phép: tạo đơn (kiểm tra số dư, trùng lịch, Idempotency-Key), duyệt/từ chối, hủy, HR hoàn tất; mỗi bước cập nhật đơn + số dư + lịch sử + audit trong một transaction; review PR | 6 endpoint /leave-requests, e2e test cho từng bước chuyển trạng thái |
| TV2 | Bảng outbox và publisher đẩy event sang queue; 5 event LeaveRequest*; API tra cứu đơn theo scope mine/team/all; cập nhật openapi.yaml | Event vào được queue, openapi.yaml cập nhật |
| TV3 | Màn hình tạo đơn, đơn của tôi, duyệt đơn (manager), xử lý đơn (HR), tra cứu audit (HR) | Demo luồng nghỉ phép end-to-end trên giao diện |
| TV4 | RabbitMQ trong docker-compose; worker Notification gửi email qua Mailpit, retry + dead-letter queue, bỏ qua event trùng; chốt cloud provider và map capability | Worker gửi được email, bảng mapping cloud service |

## 3. Quyết định quan trọng

### ADR-04 – Tech stack: NestJS + React + PostgreSQL + Keycloak

**Bối cảnh:** nhóm 4 người, còn 7 tuần; kiến trúc đã chốt là modular monolith (ADR-01) trên PostgreSQL (ADR-02); cần OIDC
chuẩn để khi lên cloud thay bằng managed identity provider (ADR-00).

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | NestJS (TypeScript) | Framework Node.js có module, dependency injection, guard; frontend React cùng ngôn ngữ |
| B | Spring Boot (Java) | Framework enterprise, chặt chẽ; frontend React dùng ngôn ngữ khác |
| C | FastAPI (Python) | Gọn, nhanh viết; thuận cho AI; frontend React dùng ngôn ngữ khác |

**Tiêu chí lựa chọn:**

| Tiêu chí | Trọng số | A | B | C |
|---|---|---|---|---|
| Cả 4 người đọc và review được code của nhau (một ngôn ngữ cho FE + BE) | 30% | 5 | 2 | 2 |
| Hỗ trợ sẵn cấu trúc module, DI, guard cho modular monolith | 25% | 5 | 5 | 3 |
| Tốc độ phát triển trong 7 tuần | 20% | 4 | 3 | 5 |
| Thư viện cho OIDC, ORM, migration, OpenAPI | 15% | 4 | 5 | 4 |
| Thuận lợi cho phần AI (tuần 12) | 10% | 3 | 3 | 5 |
| **Tổng điểm có trọng số** | | **4.45** | **3.50** | **3.45** |

**Giải pháp được chọn:** A, với TypeORM truy cập PostgreSQL và Keycloak làm identity provider khi chạy local.

**Trade-off:** TypeScript chặt chẽ kém Java ở quy mô rất lớn; phần AI gọi LLM API qua HTTP thay vì dùng thư viện Python;
Keycloak tốn khoảng 500 MB RAM khi chạy local.

**Tiêu chí nghiệm thu:**
- Mọi thành viên clone repo và chạy được hệ thống trong dưới 15 phút theo hướng dẫn.
- Đổi từ Keycloak local sang managed identity provider chỉ bằng biến môi trường `OIDC_ISSUER`, `OIDC_JWKS_URI`.
- `npm run lint` và `npm test` chạy được trên cả Windows và Linux.

**Khi nào xem lại:** nếu phần AI cần thư viện chỉ có ở Python, tách AI assistant thành service Python riêng (đã là ứng viên tách theo ADR-01).

### QĐ-04 – Mã hóa trường nhạy cảm ở tầng ứng dụng

**Bối cảnh:** NFR yêu cầu CCCD, số tài khoản, lương mã hóa at rest và chỉ HR xem được; ngay cả người có quyền đọc database
(admin, backup bị lộ) cũng không được thấy.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Chỉ mã hóa ổ đĩa | Dùng mã hóa at rest có sẵn của managed database |
| B | Mã hóa trong database (pgcrypto) | Hàm mã hóa của PostgreSQL, khóa truyền vào câu SQL |
| C | Mã hóa ở tầng ứng dụng (AES-256-GCM) | API mã hóa trước khi ghi, giải mã khi HR xem; khóa nằm ngoài database |

**Tiêu chí lựa chọn:**

| Tiêu chí | Trọng số | A | B | C |
|---|---|---|---|---|
| Người đọc được database / backup vẫn không thấy dữ liệu | 35% | 1 | 3 | 5 |
| Khóa không lộ qua log SQL hay database | 20% | 3 | 2 | 5 |
| Phát hiện dữ liệu bị sửa | 15% | 1 | 2 | 5 |
| Độ phức tạp code | 15% | 5 | 3 | 3 |
| Tìm kiếm / lọc trên trường đó | 15% | 5 | 2 | 1 |
| **Tổng điểm có trọng số** | | **2.60** | **2.50** | **4.10** |

**Giải pháp được chọn:** C, **kết hợp với** A khi lên cloud (hai lớp). Trường nhạy cảm tách sang bảng `employee_sensitive`.

**Trade-off:** không tìm kiếm hay sắp xếp được theo lương, CCCD trong database; mất khóa là mất dữ liệu, nên khóa phải được
quản lý cẩn thận (tuần 9 chuyển sang secret manager).

**Tiêu chí nghiệm thu:**
- Đọc thẳng bảng `employee.employee_sensitive` chỉ thấy chuỗi mã hóa.
- Sửa một byte trong chuỗi mã hóa thì giải mã báo lỗi (unit test).
- Nhân viên, quản lý, admin gọi `?include=sensitive` đều bị 403; HR xem được và có một dòng audit `VIEW_SENSITIVE` (e2e test).

**Khi nào xem lại:** cần tìm theo CCCD thì thêm cột hash (HMAC) để tra cứu chính xác mà không giải mã.

### QĐ-05 – Audit log append-only khóa ở mức database

**Bối cảnh:** UC7 và NFR yêu cầu log chỉ được thêm, không ai sửa/xóa, kể cả khi code có lỗi.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Chỉ quy ước trong code | Code không bao giờ gọi UPDATE/DELETE trên audit_log |
| B | Trigger trong PostgreSQL | Trigger chặn mọi UPDATE/DELETE trên audit_log |
| C | Lưu ra dịch vụ log bất biến | Đẩy audit sang storage dạng WORM / dịch vụ log của cloud |

**Tiêu chí lựa chọn:**

| Tiêu chí | Trọng số | A | B | C |
|---|---|---|---|---|
| Chặn được sửa/xóa kể cả khi code lỗi | 35% | 1 | 4 | 5 |
| Ghi audit cùng transaction với thao tác | 30% | 5 | 5 | 2 |
| Tra cứu audit linh hoạt (theo đối tượng, người, thời gian) | 20% | 5 | 5 | 3 |
| Công triển khai | 15% | 5 | 4 | 2 |
| **Tổng điểm có trọng số** | | **3.60** | **4.50** | **3.25** |

**Giải pháp được chọn:** B.

**Trade-off:** người có quyền superuser của database vẫn tắt được trigger; xóa dữ liệu khi test phải dùng `TRUNCATE`
(chỉ dùng trong seed `--reset` ở môi trường dev).

**Tiêu chí nghiệm thu:** chạy `DELETE FROM audit.audit_log` bị database từ chối với thông báo "audit_log là append-only" (e2e test).

**Khi nào xem lại:** tuần 9 (threat model) nếu yêu cầu chống cả admin database thì sao chép audit sang storage bất biến (C).

### QĐ-06 – Role MANAGER suy ra từ sơ đồ tổ chức

**Bối cảnh:** khoảng 150 quản lý; người làm quản lý thay đổi theo sơ đồ tổ chức; quyền duyệt đơn phải khớp với quan hệ quản lý thật.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Gán tay trong Keycloak | Admin gán role manager cho từng người |
| B | Gán trong bảng role_assignment | HR gán role trong hệ thống |
| C | Suy ra khi đăng nhập | Ai có nhân viên trực thuộc thì có role MANAGER |

**Tiêu chí lựa chọn:**

| Tiêu chí | Trọng số | A | B | C |
|---|---|---|---|---|
| Luôn khớp với sơ đồ tổ chức | 40% | 1 | 2 | 5 |
| Công quản trị | 30% | 1 | 2 | 5 |
| Dễ hiểu, dễ kiểm tra | 15% | 4 | 4 | 4 |
| Hiệu năng (truy vấn thêm mỗi request) | 15% | 5 | 4 | 3 |
| **Tổng điểm có trọng số** | | **2.05** | **2.60** | **4.55** |

**Giải pháp được chọn:** C. Role HR và ADMIN vẫn gán rõ ràng (Keycloak hoặc `role_assignment`), không suy ra.

**Trade-off:** mỗi request thêm một truy vấn kiểm tra nhân viên trực thuộc (có index `manager_id`, dưới 1 ms ở 2,000 nhân viên).
Role MANAGER chỉ cho biết "là quản lý"; quyền duyệt từng đơn vẫn kiểm tra "là quản lý trực tiếp của người tạo đơn".

**Tiêu chí nghiệm thu:** tài khoản `manager` có role MANAGER, `employee` thì không (e2e test); HR đổi quản lý của một nhân viên
thì lần đăng nhập sau role được cập nhật mà không phải sửa gì trong Keycloak.

**Khi nào xem lại:** cần quản lý ủy quyền (duyệt thay khi quản lý nghỉ) thì thêm bảng ủy quyền.
