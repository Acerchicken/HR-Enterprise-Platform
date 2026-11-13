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

> Đã chuyển sang file riêng: [ADR-04 – Tech stack: NestJS + React + PostgreSQL + Keycloak](../../architecture/adr/ADR-04-tech-stack.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).

### ADR-08 – Mã hóa trường nhạy cảm ở tầng ứng dụng

> Đã chuyển sang file riêng: [ADR-08 – Mã hóa trường nhạy cảm ở tầng ứng dụng](../../architecture/adr/ADR-08-field-encryption.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).

### ADR-09 – Audit log append-only khóa ở mức database

> Đã chuyển sang file riêng: [ADR-09 – Audit log append-only khóa ở mức database](../../architecture/adr/ADR-09-append-only-audit.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).

### ADR-10 – Role MANAGER suy ra từ sơ đồ tổ chức

> Đã chuyển sang file riêng: [ADR-10 – Role MANAGER suy ra từ sơ đồ tổ chức](../../architecture/adr/ADR-10-manager-role-derived.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).

### ADR-11 – Điều chỉnh phân vai cho giai đoạn code

> Đã chuyển sang file riêng: [ADR-11 – Điều chỉnh phân vai cho giai đoạn code](../../architecture/adr/ADR-11-role-adjustment.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).
