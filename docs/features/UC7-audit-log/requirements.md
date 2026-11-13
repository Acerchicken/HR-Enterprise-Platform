# UC7 – Lịch sử thao tác: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh làm UC7. Luồng chi tiết: [spec.md](spec.md). Nguồn FR: [SRS mục 4.7](../../requirements/SRS.md#47-uc7--lịch-sử-thao-tác-fr-7x).
> Quyết định: [ADR-09](../../architecture/adr/ADR-09-append-only-audit.md). Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-7.1 | HR | Mọi thao tác quan trọng tự được ghi lại | Trả lời được "ai đã làm gì, lúc nào" | FR-7.1 |
| US-7.2 | Kiểm toán, ban giám đốc | Không ai sửa hay xóa được lịch sử | Tin được lịch sử đó | FR-7.2 |
| US-7.3 | HR, ADMIN | Tra cứu theo đối tượng, người thực hiện, khoảng thời gian | Điều tra một sự việc nhanh | FR-7.3 |

## 2. Tiêu chí chấp nhận

### FR-7.1 Ghi audit (M, đã có)

- **AC-7.1.1** Mỗi thao tác trong bảng "Các thao tác được ghi" của [spec.md](spec.md#2-tác-nhân-và-quyền) tạo đúng một bản ghi
  có người thực hiện, hành động, loại và ID đối tượng, thời điểm, `traceId`, danh sách trường đã đổi.
- **AC-7.1.2** Khi thao tác nghiệp vụ lỗi giữa chừng. Thì không có bản ghi audit và không có thay đổi dữ liệu (cùng giao dịch).
- **AC-7.1.3** Audit không chứa giá trị CCCD, số tài khoản, lương (chỉ `***`), không chứa lý do nghỉ (ADR-08, BR-14). Không chứa
  ghi chú tự do của đơn nghỉ (UC4 AC-4.7.4) và giá trị trường cá nhân (UC1 AC-1.4.3).

### FR-7.2 Chỉ thêm, không sửa xóa (M, đã có)

- **AC-7.2.1** Khi bất kỳ tài khoản nào, kể cả tài khoản của ứng dụng, chạy UPDATE hoặc DELETE trên `audit.audit_log`. Thì
  database trigger chặn, giao dịch lỗi.

### FR-7.3 Tra cứu (M, có API, chưa có giao diện)

- **AC-7.3.1** Khi HR hoặc ADMIN lọc theo `entity`, `entityId`, `actor`, `from`, `to`. Thì chỉ trả bản ghi khớp, mới nhất
  trước, có phân trang.
- **AC-7.3.2** Khi nhân viên hoặc quản lý gọi. Thì trả 403.
- **AC-7.3.3** Khi ngày sai định dạng ISO 8601 hoặc `size` lớn hơn 100. Thì trả 400.
- **AC-7.3.4** *(chưa có)* Trang "Lịch sử thao tác": chọn đối tượng, nhập ID, người thực hiện, khoảng thời gian; bảng kết quả
  có thời điểm, người, hành động, `traceId`.
- **AC-7.3.5** *(chưa đạt)* Khi lọc `from=2026-11-01&to=2026-11-01`. Thì trả mọi bản ghi trong ngày 1/11 theo giờ Việt Nam
  (`to` tính cả ngày kết thúc).

### Chưa có (NFR)

- **AC-7.4.1** *(chưa có)* Đăng nhập thành công, thất bại, bị khóa và mọi lần cấp, thu hồi vai trò HR, ADMIN được ghi lại
  (NFR-5.10).

## 3. Yêu cầu phi chức năng liên quan

NFR-6.1 → NFR-6.4 (audit đủ, không sửa được, thời gian lưu, `traceId`); NFR-2.4 (tra cứu p95 < 1 s với ~3,75 triệu bản ghi);
NFR-5.10 (audit đăng nhập).

## 4. Việc còn lại

Lịch làm theo [kế hoạch theo chức năng tuần 11–13](../../progress/tuan-04-ke-hoach-tong.md#7-kế-hoạch-theo-chức-năng-tuần-11--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Màn hình tra cứu; `to` tính cả ngày kết thúc | AC-7.3.4, AC-7.3.5 | TV1 | `feat/audit-ui` | 10, chưa xong thì đầu tuần 11 |
| Chốt thời gian lưu audit: BR-13 (5 năm) hay NFR-6.3 (2 năm) | – | TV2 | `docs/org-integrity-rules` | 11 |
| Ca kiểm thử lọc theo `actor`, thời gian; audit không chứa giá trị nhạy cảm; thao tác lỗi không sinh audit | AC-7.1.2, AC-7.1.3, AC-7.3.1 | TV4 | `docs/test-cases-week11` | 11 |
| Đo NFR-2.4 với 3,75 triệu bản ghi giả | – | TV4 | trong load test tuần 11 | 11 |
| Audit đăng nhập, cấp và thu hồi vai trò (cắt đầu tiên nếu thiếu thời gian) | AC-7.4.1 | TV3 | `infra/idp-auth-events` | 13 |
