# Quyết định kiến trúc (ADR)

> Thuộc [SAD](../SAD.md). Bộ tài liệu: [`docs/README.md`](../../README.md).

ADR (Architecture Decision Record) là bản ghi một quyết định kiến trúc quan trọng. Mỗi bản ghi gồm:
- bối cảnh;
- các phương án đã cân nhắc;
- tiêu chí so sánh;
- phương án được chọn và lý do;
- đánh đổi;
- tiêu chí nghiệm thu;
- khi nào xem lại.

Thư mục này giữ **mỗi ADR một file**, theo cách làm của Michael Nygard và mẫu MADR.

## Danh sách

| ADR | Quyết định | Góc nhìn | Trạng thái | Ngày quyết định | Người viết |
|---|---|---|---|---|---|
| [ADR-00](ADR-00-managed-services.md) | Dùng managed services cho database, storage và identity | Hệ thống | Đã chấp nhận | 12/10/2026 | TV1 (Dương) |
| [ADR-01](ADR-01-modular-monolith.md) | Modular monolith thay vì microservices | Phần mềm | Đã chấp nhận | 19/10/2026 | TV1 (Dương) |
| [ADR-02](ADR-02-postgresql.md) | PostgreSQL thay vì NoSQL | Cả hai | Đã chấp nhận | 19/10/2026 | TV2 (Thanh) |
| [ADR-03](ADR-03-sync-workflow-async-notification.md) | Workflow đồng bộ, thông báo và index bất đồng bộ | Cả hai | Đã chấp nhận | 19/10/2026 | TV1 (Dương) |
| [ADR-04](ADR-04-tech-stack.md) | Tech stack: NestJS + React + PostgreSQL + Keycloak | Phần mềm | Đã chấp nhận | 26/10/2026 | TV1 (Dương) |
| [ADR-05](ADR-05-mvp-scope.md) | Phạm vi MVP: một luồng nghiệp vụ nghỉ phép end-to-end | Nghiệp vụ | Đã chấp nhận | 5/10/2026 | Nhóm |
| [ADR-06](ADR-06-availability-50-rps.md) | Availability 99.5% và thiết kế cho 50 RPS (không dùng Kubernetes) | Hệ thống | Đã chấp nhận | 12/10/2026 | Nhóm |
| [ADR-07](ADR-07-no-redis.md) | Không dùng Redis ở MVP | Phần mềm | Đã chấp nhận | 19/10/2026 | TV3 (Bảo) |
| [ADR-08](ADR-08-field-encryption.md) | Mã hóa trường nhạy cảm ở tầng ứng dụng | Phần mềm | Đã chấp nhận | 26/10/2026 | TV1 (Dương) |
| [ADR-09](ADR-09-append-only-audit.md) | Audit log append-only khóa ở mức database | Phần mềm | Đã chấp nhận | 26/10/2026 | TV1 (Dương) |
| [ADR-10](ADR-10-manager-role-derived.md) | Role MANAGER suy ra từ sơ đồ tổ chức | Phần mềm | Đã chấp nhận | 26/10/2026 | TV1 (Dương) |
| [ADR-11](ADR-11-role-adjustment.md) | Điều chỉnh phân vai cho giai đoạn code | Dự án | Đã chấp nhận | 26/10/2026 | TV1 (Dương) |
| [ADR-12](ADR-12-cloud-provider.md) | Chọn cloud provider | Hệ thống | Đã chấp nhận | 8/11/2026 (PR #52) | TV3 (Bảo) |
| [ADR-13](ADR-13-document-storage.md) | Kho tài liệu: tải lên trực tiếp, tải xuống qua API, lọc phạm vi trong truy vấn | Phần mềm | Đã chấp nhận | 12/11/2026 | TV1 (Dương) |

Số thứ tự không trùng với thứ tự thời gian. ADR-00 → ADR-04 được đánh số ngay khi ra quyết định; ADR-05 → ADR-11 được ghi lại
sau theo cùng khung. ADR tiếp theo là **ADR-14**.

## Trạng thái

| Trạng thái | Nghĩa |
|---|---|
| Đề xuất | Đang viết hoặc đang review trên PR, chưa áp dụng |
| Đã chấp nhận | PR đã merge; code và tài liệu phải theo quyết định này |
| Bị thay thế bởi ADR-nn | Có quyết định mới thay thế; giữ file để biết vì sao từng chọn như vậy |
| Đã hủy | Không còn áp dụng và không có quyết định thay thế |

## Quy tắc

1. **Mỗi quyết định một file** `ADR-nn-ten-ngan.md`. Tên ngắn viết không dấu, nối bằng gạch ngang. Viết theo [mẫu](template.md).
2. **Mở PR riêng** cho mỗi ADR mới, trạng thái "Đề xuất". Khi PR được merge, đổi trạng thái thành "Đã chấp nhận" ngay trong PR đó,
   rồi thêm một dòng vào bảng ở trên.
3. **Không sửa nội dung một ADR đã chấp nhận.** Muốn đổi quyết định thì viết ADR mới. Ở ADR cũ, đổi trạng thái thành "Bị thay thế
   bởi ADR-nn" và thêm một dòng vào mục "Lịch sử thay đổi".
4. **Thay đổi nhỏ** không đổi lựa chọn (ví dụ lùi thời điểm, chỉnh tiêu chí nghiệm thu) thì ghi vào mục "Lịch sử thay đổi" kèm ngày
   và link tới nơi quyết định.
5. **Bảng tiêu chí** chấm điểm từ 1 đến 5, không dùng trọng số hay phần trăm.
6. **Báo cáo tuần** chỉ link tới file ADR, không chép nội dung.
