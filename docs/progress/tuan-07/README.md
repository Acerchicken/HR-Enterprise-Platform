# Tuần 7 (19/10 – 26/10) – Implementation 1: Nền tảng

Tuần 7 hoàn thành phần nền tảng theo kế hoạch: repo chạy được ở local, có đăng nhập OIDC qua Keycloak, module Employee,
Organization, Audit, dữ liệu mẫu 2,000 nhân viên và frontend gọi được API. Module Leave đã có data model và state machine,
API workflow làm ở tuần 8. Tech stack chốt trong ADR-04: **NestJS + React + PostgreSQL + Keycloak**.

## 1. Các công việc đã hoàn thành

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (Duong, nhóm trưởng) | Chốt tech stack (ADR-04); khung modular monolith, quy ước code, quy trình PR; migration 5 schema; module Identity, Employee, Organization, Audit; module Leave (entity + state machine); frontend (đăng nhập, hồ sơ, danh bạ, chi tiết nhân viên, sơ đồ tổ chức); docker-compose, realm Keycloak, seed 2,000 nhân viên | Repo chạy được ở local, 13 endpoint | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | Không có công việc hoàn thành | – | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | Không có công việc hoàn thành | – | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | Không có công việc hoàn thành | – | [TV4_Duy.md](TV4_Duy.md) |

**Chưa làm được theo kế hoạch:** kế hoạch tuần 6 chia phần code cho cả 4 người, thực tế chỉ TV1 code. Nhóm điều chỉnh phân vai
từ tuần 8 (ADR-11). Map capability sang cloud service vẫn chờ chốt provider, chuyển cho TV3 ở tuần 8.

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 8: 26/10 – 2/11)

Phân vai mới theo ADR-11: TV1 Duong, TV2 Thanh, TV3 Bảo, TV4 Duy.

| Thành viên | Vai trò | Công việc | Output |
|---|---|---|---|
| TV1 (Duong, nhóm trưởng) | Code chính | API workflow nghỉ phép (tạo, duyệt/từ chối, hủy, HR hoàn tất) trong một transaction; outbox + publisher; worker gửi email; 5 màn hình nghỉ phép; review và merge PR | Demo luồng nghỉ phép end-to-end ở local, e2e test theo ca kiểm thử của TV4 |
| TV2 (Thanh) | Nghiệp vụ | Bảng business rule luồng nghỉ phép (số dư, trùng lịch, nghỉ nửa ngày, hủy đơn, quản lý vắng mặt, HR hoàn tất); sơ đồ quy trình nghỉ phép; đối chiếu business rule UC1, UC2 trong code tuần 7 với functional requirements tuần 5 | `docs/business/leave-rules.md`, sơ đồ quy trình, issue cho các điểm lệch |
| TV3 (Bảo) | Cloud, IaC, CI/CD | Chọn cloud provider (ADR-12), map capability + chi phí; CI GitHub Actions; RabbitMQ + Mailpit trong docker-compose | ADR-12, bảng mapping, `.github/workflows/ci.yml` |
| TV4 (Duy) | Một phần nghiệp vụ + ca kiểm thử | Danh mục loại phép và ngày lễ 2026; ca kiểm thử cho 5 bước workflow (dựa trên business rule của TV2); kiểm thử chức năng các màn hình tuần 7 với 4 tài khoản demo | `docs/business/leave-types-holidays.md`, `docs/business/leave-test-cases.md`, biên bản kiểm thử, issue |

Thứ tự phụ thuộc: TV2 giao business rule trước thứ 3 để TV4 viết ca kiểm thử và TV1 code theo; TV4 giao ca kiểm thử trước thứ 5; TV3 xong docker-compose trước thứ 4 để TV1 viết worker.

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

| Tiêu chí | A | B | C |
|---|---|---|---|
| Cả 4 người đọc và review được code của nhau (một ngôn ngữ cho FE + BE) | 5 | 2 | 2 |
| Hỗ trợ sẵn cấu trúc module, DI, guard cho modular monolith | 5 | 5 | 3 |
| Tốc độ phát triển trong 7 tuần | 4 | 3 | 5 |
| Thư viện cho OIDC, ORM, migration, OpenAPI | 4 | 5 | 4 |
| Thuận lợi cho phần AI (tuần 12) | 3 | 3 | 5 |

**Giải pháp được chọn:** A, với TypeORM truy cập PostgreSQL và Keycloak làm identity provider khi chạy local.

**Trade-off:** TypeScript chặt chẽ kém Java ở quy mô rất lớn; phần AI gọi LLM API qua HTTP thay vì dùng thư viện Python;
Keycloak tốn khoảng 500 MB RAM khi chạy local.

**Tiêu chí nghiệm thu:**
- Mọi thành viên clone repo và chạy được hệ thống trong dưới 15 phút theo hướng dẫn.
- Đổi từ Keycloak local sang managed identity provider chỉ bằng biến môi trường `OIDC_ISSUER`, `OIDC_JWKS_URI`.
- `npm run lint` chạy được trên cả Windows và Linux.

**Khi nào xem lại:** nếu phần AI cần thư viện chỉ có ở Python, tách AI assistant thành service Python riêng (đã là ứng viên tách theo ADR-01).

### ADR-08 – Mã hóa trường nhạy cảm ở tầng ứng dụng

**Bối cảnh:** NFR yêu cầu CCCD, số tài khoản, lương mã hóa at rest và chỉ HR xem được; ngay cả người có quyền đọc database
(admin, backup bị lộ) cũng không được thấy.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Chỉ mã hóa ổ đĩa | Dùng mã hóa at rest có sẵn của managed database |
| B | Mã hóa trong database (pgcrypto) | Hàm mã hóa của PostgreSQL, khóa truyền vào câu SQL |
| C | Mã hóa ở tầng ứng dụng (AES-256-GCM) | API mã hóa trước khi ghi, giải mã khi HR xem; khóa nằm ngoài database |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Người đọc được database / backup vẫn không thấy dữ liệu | 1 | 3 | 5 |
| Khóa không lộ qua log SQL hay database | 3 | 2 | 5 |
| Phát hiện dữ liệu bị sửa | 1 | 2 | 5 |
| Độ phức tạp code | 5 | 3 | 3 |
| Tìm kiếm / lọc trên trường đó | 5 | 2 | 1 |

**Giải pháp được chọn:** C, **kết hợp với** A khi lên cloud (hai lớp). Trường nhạy cảm tách sang bảng `employee_sensitive`.

**Trade-off:** không tìm kiếm hay sắp xếp được theo lương, CCCD trong database; mất khóa là mất dữ liệu, nên khóa phải được
quản lý cẩn thận (tuần 9 chuyển sang secret manager).

**Tiêu chí nghiệm thu:**
- Đọc thẳng bảng `employee.employee_sensitive` chỉ thấy chuỗi mã hóa.
- Sửa một byte trong chuỗi mã hóa thì giải mã báo lỗi.
- Nhân viên, quản lý, admin gọi `?include=sensitive` đều bị 403; HR xem được và có một dòng audit `VIEW_SENSITIVE`.

**Khi nào xem lại:** cần tìm theo CCCD thì thêm cột hash (HMAC) để tra cứu chính xác mà không giải mã.

### ADR-09 – Audit log append-only khóa ở mức database

**Bối cảnh:** UC7 và NFR yêu cầu log chỉ được thêm, không ai sửa/xóa, kể cả khi code có lỗi.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Chỉ quy ước trong code | Code không bao giờ gọi UPDATE/DELETE trên audit_log |
| B | Trigger trong PostgreSQL | Trigger chặn mọi UPDATE/DELETE trên audit_log |
| C | Lưu ra dịch vụ log bất biến | Đẩy audit sang storage dạng WORM / dịch vụ log của cloud |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Chặn được sửa/xóa kể cả khi code lỗi | 1 | 4 | 5 |
| Ghi audit cùng transaction với thao tác | 5 | 5 | 2 |
| Tra cứu audit linh hoạt (theo đối tượng, người, thời gian) | 5 | 5 | 3 |
| Công triển khai | 5 | 4 | 2 |

**Giải pháp được chọn:** B.

**Trade-off:** người có quyền superuser của database vẫn tắt được trigger; xóa dữ liệu khi test phải dùng `TRUNCATE`
(chỉ dùng trong seed `--reset` ở môi trường dev).

**Tiêu chí nghiệm thu:** chạy `DELETE FROM audit.audit_log` bị database từ chối với thông báo "audit_log là append-only".

**Khi nào xem lại:** tuần 9 (threat model) nếu yêu cầu chống cả admin database thì sao chép audit sang storage bất biến (C).

### ADR-10 – Role MANAGER suy ra từ sơ đồ tổ chức

**Bối cảnh:** khoảng 150 quản lý; người làm quản lý thay đổi theo sơ đồ tổ chức; quyền duyệt đơn phải khớp với quan hệ quản lý thật.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Gán tay trong Keycloak | Admin gán role manager cho từng người |
| B | Gán trong bảng role_assignment | HR gán role trong hệ thống |
| C | Suy ra khi đăng nhập | Ai có nhân viên trực thuộc thì có role MANAGER |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Luôn khớp với sơ đồ tổ chức | 1 | 2 | 5 |
| Công quản trị | 1 | 2 | 5 |
| Dễ hiểu, dễ kiểm tra | 4 | 4 | 4 |
| Hiệu năng (truy vấn thêm mỗi request) | 5 | 4 | 3 |

**Giải pháp được chọn:** C. Role HR và ADMIN vẫn gán rõ ràng (Keycloak hoặc `role_assignment`), không suy ra.

**Trade-off:** mỗi request thêm một truy vấn kiểm tra nhân viên trực thuộc (có index `manager_id`, dưới 1 ms ở 2,000 nhân viên).
Role MANAGER chỉ cho biết "là quản lý"; quyền duyệt từng đơn vẫn kiểm tra "là quản lý trực tiếp của người tạo đơn".

**Tiêu chí nghiệm thu:** tài khoản `manager` có role MANAGER, `employee` thì không; HR đổi quản lý của một nhân viên
thì lần đăng nhập sau role được cập nhật mà không phải sửa gì trong Keycloak.

**Khi nào xem lại:** cần quản lý ủy quyền (duyệt thay khi quản lý nghỉ) thì thêm bảng ủy quyền.

### ADR-11 – Điều chỉnh phân vai cho giai đoạn code

**Bối cảnh:** kế hoạch tuần 6 chia phần code tuần 7 cho cả 4 người theo module. Thực tế tuần 7 chỉ TV1 code; TV4, TV2, TV3
chưa có công việc hoàn thành. Còn 6 tuần, phần code đã có khung thống nhất, và mỗi thành viên vẫn cần có đóng góp rõ ràng,
kiểm chứng được trên repo.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Giữ phân vai cũ | Mỗi người code module của mình như kế hoạch tuần 4 |
| B | Một người code chính, ba người theo chuyên môn | TV1 code; TV2 nghiệp vụ; TV3 cloud, IaC, CI/CD; TV4 một phần nghiệp vụ + ca kiểm thử |
| C | Code theo cặp | Hai cặp, mỗi cặp một nửa số module |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Khả thi với thực tế tham gia của nhóm | 1 | 5 | 2 |
| Kiến trúc và code nhất quán | 2 | 5 | 3 |
| Mỗi thành viên có output riêng, kiểm chứng được | 4 | 4 | 3 |
| Không dồn rủi ro vào một người | 4 | 2 | 4 |
| Bám kế hoạch tổng 10 tuần (output từng tuần) | 3 | 4 | 3 |

**Giải pháp được chọn:** B. Output từng tuần của kế hoạch tổng giữ nguyên; chỉ đổi người làm.

**Trade-off:** TV1 gánh toàn bộ code ứng dụng, là điểm nghẽn: TV1 vắng hoặc chậm thì cả nhóm chậm. Ba thành viên còn lại ít
trực tiếp với code ứng dụng, nên phải chủ động đọc code để trả lời được ở phần Architecture Defense.

**Tiêu chí nghiệm thu:**
- Mỗi tuần, mỗi thành viên có ít nhất một PR hoặc issue bằng tài khoản GitHub của chính mình.
- TV2: mỗi use case có bảng business rule trước khi TV1 code; mọi điểm lệch giữa code và requirements được mở issue.
- TV3: CI chạy trên mọi PR từ tuần 8; IaC tạo lại được môi trường staging từ tuần 9.
- TV4: mỗi business rule có ít nhất một ca kiểm thử; mỗi ca có test tự động tương ứng; có biên bản kiểm thử chức năng hàng tuần.

**Khi nào xem lại:** TV1 trễ kế hoạch 2 tuần liên tiếp thì chuyển một phần code (ví dụ module Document hoặc màn hình frontend) cho thành viên khác.

