# Tuần 6 (12/10 – 19/10) – Application, Data & Integration Architecture (P2)

Tuần 6 hoàn thành bộ artifact Assignment #2 và 3 ADR. Quyết định chính: **modular monolith + PostgreSQL + message queue**.
Các bước của workflow chạy đồng bộ trong một ACID transaction, còn thông báo và index tài liệu chạy bất đồng bộ qua queue.

## 1. Các công việc đã hoàn thành

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (nhóm trưởng) | Business capability map (4 nhóm); application components (7 module + 1 worker); ADR-01, ADR-03 | Capability map, component table, 2 ADR | [Duong_TV1.md](Duong_TV1.md) |
| TV2 (Thanh) | API specification REST /api/v1 (xác thực, lỗi, idempotency); data model 11 entity + data ownership; ADR-02 | API spec, ERD, ADR-02 | [Thanh_TV2.md](Thanh_TV2.md) |
| TV3 (Bảo) | Chiến lược lưu trữ và cache; bảng sync/async; 6 business event | Bảng storage/cache, bảng sync/async, event model | [Bao_TV3.md](Bao_TV3.md) |
| TV4 (Duy) | Integration với 5 hệ thống ngoài; 8 tình huống lỗi và cách xử lý | Bảng integration, bảng failure handling | [Duy_TV4.md](Duy_TV4.md) |

**Chưa làm được theo kế hoạch:** map capability sang cloud service (vẫn chờ chốt provider).

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 7: 19/10 – 26/10)

| Thành viên | Công việc | Output |
|---|---|---|
| TV1 (nhóm trưởng) | Khung dự án modular monolith, quy ước code, quy trình review PR; bắt đầu module Leave (model + state machine) | Khung repo, tài liệu quy ước code |
| TV2 (Thanh) | OpenAPI; migration cho các schema; module Employee và Organization | OpenAPI YAML, migration, API Employee/Organization chạy local |
| TV3 (Bảo) | Khung frontend SPA; màn hình đăng nhập, hồ sơ cá nhân, danh bạ | Frontend chạy local, gọi được API |
| TV4 (Duy) | docker-compose (app + PostgreSQL); đăng nhập OIDC; seed ~2,000 nhân viên; map cloud service khi chốt provider | docker-compose, seed data, README |

## 3. Quyết định quan trọng

### ADR-01 – Modular monolith thay vì microservices

**Bối cảnh:** nhóm 4 người, 10 tuần; peak ≈ 10 RPS; một bước duyệt phải cập nhật đơn, số dư và audit cùng lúc.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Monolith thường | Một ứng dụng, code không chia ranh giới rõ |
| B | Modular monolith | Một ứng dụng + 1 worker, chia module rõ, mỗi module một schema DB, chỉ gọi nhau qua interface |
| C | Microservices | Mỗi capability một service riêng, database riêng, giao tiếp qua mạng |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Transaction đơn + số dư + audit đơn giản, đúng | 5 | 5 | 2 |
| Công deploy, debug, vận hành cho 4 người | 5 | 4 | 1 |
| Ranh giới rõ, tách được service khi cần | 1 | 4 | 5 |
| Phù hợp tải (peak 10 RPS, thiết kế 50 RPS) | 5 | 5 | 3 |
| Chi phí hạ tầng | 5 | 5 | 2 |

**Giải pháp được chọn:** B. Transaction cục bộ, không cần Saga; deploy và debug dễ; module có ranh giới rõ để tách khi cần.

**Trade-off:** phải scale cả ứng dụng; các module deploy cùng nhau; cần kỷ luật để không phá ranh giới module.
Ứng viên tách đầu tiên: Notification và AI assistant.

**Tiêu chí nghiệm thu:**
- Không module nào inject repository hay đọc bảng của module khác (kiểm tra khi review PR).
- Không có foreign key chéo schema trong migration.
- Duyệt đơn cập nhật đơn, số dư, lịch sử và audit trong đúng một transaction: lỗi giữa chừng thì không bảng nào bị thay đổi (e2e test tuần 8).

**Khi nào xem lại:** một module cần scale hoặc release độc lập (ví dụ AI assistant tốn tài nguyên), hoặc nhóm lớn hơn 8 người.

### ADR-02 – PostgreSQL thay vì NoSQL

**Bối cảnh:** dữ liệu nhiều quan hệ (nhân viên – phòng ban – quản lý – đơn); số dư phép cần strong consistency; cần truy vấn audit linh hoạt.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | PostgreSQL (managed) | Relational, ACID, có full-text search và pgvector |
| B | MongoDB | Document database, schema linh hoạt |
| C | DynamoDB | Key-value managed, scale gần như vô hạn |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Quan hệ và JOIN (tổ chức, quản lý, đơn) | 5 | 3 | 1 |
| Transaction ACID cho số dư phép | 5 | 3 | 3 |
| Truy vấn linh hoạt cho audit, báo cáo | 5 | 4 | 2 |
| Ít thành phần phải vận hành (full-text, vector có sẵn) | 5 | 3 | 2 |
| Khả năng scale ngang | 3 | 4 | 5 |
| Nhóm đã quen | 5 | 3 | 2 |

**Giải pháp được chọn:** A. Relational model + ACID; full-text search và pgvector (cho RAG tuần 12) có sẵn, ít thành phần phải vận hành.

**Trade-off:** scale ngang phức tạp hơn NoSQL, không phải vấn đề ở quy mô 10,000 nhân viên; full-text kém hơn search engine chuyên dụng.

**Tiêu chí nghiệm thu:**
- Ràng buộc nghiệp vụ quan trọng nằm ngay trong database (unique, check, foreign key trong schema).
- Tìm danh bạ trên 2,000 nhân viên p95 < 1 s; tra audit theo đối tượng dùng index, không quét cả bảng.

**Khi nào xem lại:** search tài liệu không đạt p95 < 1 s ở tuần 11 thì thêm search engine riêng cho tài liệu.

### ADR-03 – Workflow đồng bộ, thông báo và index bất đồng bộ

**Bối cảnh:** chuyển trạng thái đơn phải chính xác ngay; email provider có thể lỗi; trích text tài liệu tốn thời gian.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Toàn bộ sync | API gửi email và index ngay trong request |
| B | Toàn bộ async | Mọi thao tác, kể cả duyệt đơn, đi qua queue |
| C | Kết hợp | Workflow sync trong transaction; thông báo và index qua outbox → queue → worker |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Kết quả duyệt chính xác ngay cho người dùng | 5 | 2 | 5 |
| Lỗi email/index không làm hỏng quy trình duyệt | 1 | 5 | 5 |
| Giữ API p95 < 500 ms | 2 | 5 | 5 |
| Độ phức tạp (queue, worker, outbox) | 5 | 2 | 3 |
| Không mất event | 2 | 4 | 5 |

**Giải pháp được chọn:** C. Dùng **queue** (không dùng event stream) vì mỗi event chỉ có 1–2 consumer và vài trăm event/ngày.

**Trade-off:** thông báo đến trễ vài giây (eventual consistency); thêm queue, worker và bảng outbox; consumer phải idempotent.

**Tiêu chí nghiệm thu:**
- Tắt email provider (hoặc worker) thì vẫn duyệt đơn được, trạng thái đơn đúng; bật lại thì email được gửi bù.
- Gửi trùng một message thì email chỉ gửi một lần.
- Sau 5 lần lỗi, message vào dead-letter queue.

**Khi nào xem lại:** có nhiều consumer cần đọc lại lịch sử event (ví dụ analytics) thì cân nhắc event stream.

### ADR-07 – Không dùng Redis ở MVP

**Bối cảnh:** read-heavy (~90% đọc) nhưng tải nhỏ; dữ liệu tham chiếu (phòng ban, chức danh, loại phép) đọc nhiều, ít đổi.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Không cache | Mọi request đọc database |
| B | Cache in-memory | Cache-aside trong từng instance, TTL 10 phút, xóa khi cập nhật |
| C | Redis | Cache dùng chung giữa các instance |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Giảm tải database cho dữ liệu đọc nhiều | 2 | 4 | 5 |
| Thêm thành phần phải vận hành và chi phí | 5 | 5 | 2 |
| Dữ liệu nhất quán giữa các instance | 5 | 3 | 5 |
| Độ phức tạp code | 5 | 4 | 3 |

**Giải pháp được chọn:** B, dù điểm gần bằng A. Lý do nghiêng về B: tuần 11 cần chứng minh được chiến lược cache; dữ liệu
cũ tối đa 10 phút là chấp nhận được với phòng ban, chức danh.

**Trade-off:** hai instance có thể lệch nhau tối đa 10 phút sau khi HR sửa phòng ban. Không cache số dư phép, quyền truy cập
và dữ liệu nhạy cảm.

**Tiêu chí nghiệm thu:** gọi danh sách phòng ban 100 lần liên tiếp chỉ tạo 1 truy vấn database trong 10 phút; sửa phòng ban
xong thì instance đó trả dữ liệu mới ngay.

**Khi nào xem lại:** cần session dùng chung, rate limit dùng chung, hoặc database CPU > 60% khi load test.
