# Tuần 5 (5/10 – 12/10) – Business, Requirements & Cloud Architecture (P1)

Tuần 5 hoàn thành các artifact của P1 theo kế hoạch. Kết luận chính: workload nhỏ (peak ≈ 10 RPS) nhưng dữ liệu nhạy cảm,
nên kiến trúc ưu tiên security và audit hơn là khả năng scale.

## 1. Các công việc đã hoàn thành

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (nhóm trưởng) | Business problem statement có số đo; 4 nhóm người dùng và stakeholder; Architecture Canvas; ADR-00 | Problem statement, bảng users, Canvas, ADR-00 | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | Functional requirements cho 7 use case theo actor–action–input–output–business rule | Bảng functional requirements | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | User journey đơn nghỉ phép; NFR có target cụ thể cho 6 nhóm | User journey, bảng NFR | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | Workload analysis và ước lượng traffic (peak ≈ 10 RPS, thiết kế cho 50 RPS); kiến trúc cloud ban đầu | Bảng workload, kiến trúc v1 | [TV4_Duy.md](TV4_Duy.md) |

**Chưa làm được theo kế hoạch:** chưa chốt cloud provider, nên kiến trúc v1 mới ở mức capability (chưa gắn tên dịch vụ cụ thể).

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 6: 12/10 – 19/10)

| Thành viên | Công việc | Output |
|---|---|---|
| TV1 (nhóm trưởng) | Business capability map, application components; ADR-01 (Monolith vs Microservices), ADR-03 (Sync vs Async) | Component diagram, 2 ADR |
| TV2 (Thanh) | API specification; data model và data ownership; ADR-02 (PostgreSQL vs NoSQL) | API spec, ERD, ADR-02 |
| TV3 (Bảo) | Chiến lược storage và cache; bảng sync/async; event model | Bảng storage/cache, bảng sync/async, danh sách event |
| TV4 (Duy) | Integration với hệ thống ngoài; phân tích tình huống lỗi; map capability sang cloud service khi chốt provider | Bảng integration, bảng failure handling |

## 3. Quyết định quan trọng

### ADR-00 – Dùng managed services cho database, storage và identity

**Bối cảnh:** nhóm 4 người, 10 tuần, không có người vận hành chuyên trách; NFR yêu cầu backup, mã hóa at rest, RPO ≤ 1 giờ,
RTO ≤ 4 giờ; ngân sách < 100 USD/tháng.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Tự cài trên VM | PostgreSQL, MinIO (object storage), Keycloak cài trên 1–2 máy ảo |
| B | Managed services | Managed PostgreSQL, object storage, managed identity provider của cloud |
| C | Kết hợp | Managed database + object storage, tự chạy Keycloak trên VM |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Đáp ứng RPO ≤ 1 giờ, RTO ≤ 4 giờ (backup, point-in-time recovery) | 2 | 5 | 4 |
| Công vận hành của nhóm (vá lỗi, backup, giám sát) | 1 | 5 | 3 |
| Bảo mật có sẵn (mã hóa at rest, TLS, vá bảo mật) | 2 | 5 | 4 |
| Chi phí hàng tháng trong ngân sách | 4 | 3 | 3 |
| Mức phụ thuộc vào vendor (lock-in) | 5 | 2 | 3 |

**Giải pháp được chọn:** B. Nhóm dồn effort vào business logic (workflow, phân quyền, audit), là phần tạo ra giá trị và được chấm điểm.

**Trade-off:** phụ thuộc vendor, ít quyền tùy biến, chi phí cố định cao hơn VM tự quản. Giảm lock-in bằng cách chỉ dùng
chuẩn mở: OIDC cho đăng nhập, PostgreSQL cho database, API kiểu S3 cho object storage.

**Tiêu chí nghiệm thu:**
- Bật được backup tự động và khôi phục thử về một thời điểm trong quá khứ (point-in-time) trong vòng 4 giờ.
- Ứng dụng đổi từ môi trường local (PostgreSQL, Keycloak, MinIO chạy bằng Docker) sang dịch vụ managed chỉ bằng cách đổi biến môi trường, không sửa code.
- Chi phí ước tính cho cả 3 dịch vụ ở tier nhỏ nhất < 60 USD/tháng, chừa phần còn lại cho compute.

**Khi nào xem lại:** nếu credit sinh viên không đủ cho managed database, chuyển sang giải pháp C cho môi trường staging.

### ADR-06 – Availability 99.5% và thiết kế cho 50 RPS (không dùng Kubernetes)

**Bối cảnh:** peak ước tính ≈ 10 RPS; hệ thống nội bộ, không phải thanh toán; ngân sách < 100 USD/tháng.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | 99.9%, multi-AZ, Kubernetes | Cụm Kubernetes trên nhiều AZ, database multi-AZ |
| B | 99.5%, 2 instance sau load balancer | 2 instance của app (container service), database single-AZ có backup |
| C | 99%, 1 instance | 1 VM chạy toàn bộ |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Phù hợp nhu cầu thật (nội bộ, peak 10 RPS) | 2 | 5 | 3 |
| Chi phí | 1 | 4 | 5 |
| Độ phức tạp vận hành cho nhóm 4 người | 1 | 4 | 5 |
| Chịu được 1 instance lỗi / deploy không downtime | 5 | 4 | 1 |

**Giải pháp được chọn:** B. Hai instance là để đạt availability và deploy cuốn chiếu, không phải để scale.

**Trade-off:** chấp nhận ≈ 3.6 giờ downtime/tháng; database single-AZ là điểm lỗi đơn (bù bằng backup + PITR, RTO ≤ 4 giờ).

**Tiêu chí nghiệm thu:** load test tuần 11 ở 50 RPS đạt p95 < 300 ms (đọc) và < 500 ms (ghi); tắt 1 instance trong lúc
test thì tỷ lệ lỗi < 1%.

**Khi nào xem lại:** nếu số nhân viên vượt 10,000 hoặc yêu cầu availability lên 99.9%.
