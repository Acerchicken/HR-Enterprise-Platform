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

### FR-7.1 Ghi audit (M, đã có; AC-7.1.3, AC-7.1.4 chưa đạt một phần)

- **AC-7.1.1** Mỗi thao tác trong bảng "Các thao tác được ghi" của [spec.md](spec.md#2-tác-nhân-và-quyền) (Employee,
  Organization, Leave, Document, Identity) tạo đúng một bản ghi có người thực hiện, hành động, loại và ID đối tượng, thời điểm,
  danh sách trường đã đổi.
- **AC-7.1.2** Khi thao tác nghiệp vụ lỗi giữa chừng. Thì không có bản ghi audit và không có thay đổi dữ liệu (cùng giao dịch).
- **AC-7.1.3** Audit không chứa giá trị CCCD, số tài khoản, lương (chỉ `***`), không chứa lý do nghỉ (ADR-08, BR-14). Không chứa
  ghi chú tự do của đơn nghỉ (UC4 AC-4.7.4) và giá trị trường cá nhân (UC1 AC-1.4.3). *(chưa đạt)* `employeeCode` chỉ ghi tên
  và `***` ([quy tắc toàn vẹn tổ chức mục 3](../../business/org-integrity-rules.md#3-nội-dung-audit-theo-nhóm-trường)).
- **AC-7.1.4** *(chưa đạt ở Organization, điều chuyển, Identity)* Thao tác đến từ một request HTTP có `traceId` trùng header
  `X-Trace-Id` của response và IP client. Job, worker để `NULL` (NFR-6.4).

### FR-7.2 Chỉ thêm, không sửa xóa (M, đã có)

- **AC-7.2.1** Khi bất kỳ tài khoản nào, kể cả tài khoản của ứng dụng, chạy UPDATE hoặc DELETE trên `audit.audit_log`. Thì
  database trigger chặn, giao dịch lỗi.

### FR-7.3 Tra cứu (M, có API, chưa có giao diện)

> Duong chốt 23/11 (spec 13.3): D1 ADMIN không thấy audit đơn nghỉ, số dư phép; D2 chỉ mục theo thời gian; D3 lọc theo hành động.

- **AC-7.3.1** Khi HR hoặc ADMIN lọc theo `entity`, `entityId`, `actor`, `from`, `to`. Thì chỉ trả bản ghi khớp, mới nhất
  trước, có phân trang.
- **AC-7.3.2** Khi nhân viên hoặc quản lý gọi. Thì trả 403.
- **AC-7.3.3** Khi ngày sai định dạng ISO 8601, `actor` không phải UUID hoặc `size` lớn hơn 100. Thì trả 400.
- **AC-7.3.4** *(chưa có)* Trang "Lịch sử thao tác": chọn đối tượng, đối tượng cụ thể, người thực hiện, khoảng thời gian; bảng
  kết quả có thời điểm, tên người thực hiện ("Hệ thống" nếu không có), hành động, `traceId`.
- **AC-7.3.5** *(chưa đạt)* Khi lọc `from=2026-11-01&to=2026-11-01`. Thì trả mọi bản ghi từ 00:00 đến hết ngày 1/11 theo
  giờ Việt Nam (`from` hiện tính theo UTC nên bỏ mất 0–7 giờ sáng; `to` không tính ngày kết thúc).
- **AC-7.3.6** Khi `entity=leave_request` và ID đơn. Thì trả đủ các bước của đơn; lọc `entity=employee` không trả bước của đơn.
- **AC-7.3.7** *(chưa có)* Khi người chỉ có `ADMIN` tra cứu. Thì không có bản ghi `leave_request`, `leave_balance`; HR thấy đủ (D1,
  BR-14, NFR-5.18).
- **AC-7.3.8** *(chưa có)* Khi lọc `action=VIEW_SENSITIVE&action=ROLE_GRANT`. Thì chỉ trả hai hành động đó; hành động lạ trả 400 (D3).

### NFR-5.10 Ghi đăng nhập và cấp quyền

- **AC-7.4.1** *(chưa có)* Đăng nhập thành công, thất bại, bị khóa được ghi lại (NFR-5.10, ADR-17 mục 6).
- **AC-7.4.2** Mọi lần cấp, thu hồi vai trò HR, ADMIN có audit `ROLE_GRANT`, `ROLE_REVOKE` kèm người làm, vai trò, lý do (đã có
  qua UC8 AC-8.7.1, AC-8.7.2, AC-8.7.9).

## 3. Yêu cầu phi chức năng liên quan

NFR-6.1 → NFR-6.4 (audit đủ, không sửa được, lưu 5 năm theo BR-13, `traceId`); NFR-2.4 (tra cứu p95 < 1 s với ~3,75 triệu bản ghi);
NFR-5.10 (audit đăng nhập).

## 4. Việc còn lại

Lịch làm theo [kế hoạch hoàn thành từng chức năng](../../progress/ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Màn hình tra cứu; `from`, `to` theo giờ Việt Nam; `actorName`; `traceId` ở mọi module; bỏ giá trị `employeeCode`; D1 → D3 (lọc ADMIN, `ix_audit_at`, lọc `action`) | AC-7.1.3, AC-7.1.4, AC-7.3.4, AC-7.3.5, AC-7.3.7, AC-7.3.8 | TV1 | `feat/audit-ui` | 11 (trễ) |
| ~~Chốt thời gian lưu audit~~: đã chốt 5 năm (BR-13), SRS NFR-6.3 sửa theo | – | TV2 | `docs/org-integrity-rules` | Xong |
| Ca kiểm thử lọc theo `actor`, thời gian; audit không chứa giá trị nhạy cảm; thao tác lỗi không sinh audit; `traceId` | AC-7.1.2, AC-7.1.3, AC-7.1.4, AC-7.3.1, AC-7.3.6 | TV4 | `docs/test-cases-uc2-uc5-uc7` | 11 |
| Đo NFR-2.4 với 3,75 triệu bản ghi giả | – | TV4 | trong load test tuần 11 | 11 |
| Audit đăng nhập (cắt đầu tiên nếu thiếu thời gian); cấp, thu hồi vai trò đã xong ở UC8 | AC-7.4.1 | TV3 | `infra/idp-auth-events` | 13 |
