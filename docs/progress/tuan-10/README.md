# Tuần 10 (9/11 – 16/11) – Hoàn thiện chức năng

Mục tiêu tuần:
1. **Chuẩn bị lên AWS, chưa tạo tài nguyên:** có kết quả `terraform plan` thật, code Terraform cho tài liệu và email, kế hoạch lên
   AWS tuần 12–13. Không `terraform apply` trong tuần này (xem quyết định ở mục 3).
2. **Đủ 7 use case:** kho tài liệu HR (UC5), tìm kiếm tài liệu (UC6), giao diện HR tạo và sửa hồ sơ (UC1), giao diện xem audit
   (UC7).
3. **Hoàn thiện nghiệp vụ nghỉ phép:** mỗi người đúng một quản lý trừ CEO, HR duyệt đơn CEO, người duyệt thay (BR-06), tạo đơn hộ
   (BR-12).
4. **Bảo mật:** các khoảng trống mức cao của threat model (kiểm `email_verified`).

Phân vai theo ADR-11: TV1 Duong code, TV2 Thanh nghiệp vụ + bảo mật nghiệp vụ, TV3 Bảo cloud, IaC, CI/CD, TV4 Duy kiểm thử.

> File này là kế hoạch đầu tuần. Thứ 2 (16/11) nhóm điền mục 1–3 để làm báo cáo.

## Quy trình

Áp dụng [`CONVENTIONS.md` mục 6](../../CONVENTIONS.md#quy-trình-cho-một-việc): mỗi việc một nhánh tách từ `dev`, mỗi nhánh một PR
vào `dev`, review và sửa ngay trên PR tới khi được approve. Góp ý và review phải có trên GitHub.

Trong bảng dưới, **"Mở PR"** là hạn mở PR, **"Merge"** là hạn PR được approve và merge.

## Thứ tự ưu tiên

Theo mức độ trong BRD. Nếu không đủ thời gian thì cắt từ dưới lên và ghi vào báo cáo, không làm dở nhiều việc cùng lúc.

| Mức | Việc | Yêu cầu (SRS) |
|---|---|---|
| 1 | `terraform plan` thật (không `apply`), MinIO local cho kho tài liệu | ADR-12 |
| 2 (M) | Kho tài liệu, tìm tài liệu, HR tạo/sửa hồ sơ, xem audit, quy tắc một quản lý | FR-5.1, 5.2, 6.2, 1.4, 1.5, 7.3, 2.5 |
| 3 (S) | HR duyệt đơn CEO, phiên bản tài liệu, người duyệt thay, tạo đơn hộ | FR-4.4, 5.3, 4.3, 3.7 |

## Kế hoạch tuần 10 theo nhánh

| Nhánh | Người | Việc | Output | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| (không có nhánh) | TV3 Bảo | `terraform plan` thật, **không `apply`** | Dòng `Plan: N to add` | T5 (12/11), 21:00 | – | TV1 |
| `docs/document-rules` | TV2 Thanh | Quy tắc kho tài liệu: loại, phạm vi xem, phiên bản, tìm kiếm | `docs/business/document-rules.md` | **T3 (10/11), 21:00** | T4 (11/11) | TV1, TV4 |
| `docs/retention-leave-reason` | TV2 Thanh | Thời gian lưu audit, đơn nghỉ; ai xem lý do nghỉ ốm; nội dung email | Bổ sung `leave-rules.md` | T4 (11/11), 21:00 | T5 (12/11) | TV1 |
| `feat/employee-manager-rule` | TV1 Duong | Quy tắc một quản lý trừ CEO; HR duyệt đơn CEO (issue #22) | PR code + e2e | T3 (10/11) | T4 (11/11) | TV2 |
| `chore/minio-local` | TV3 Bảo | MinIO trong docker-compose cho kho tài liệu local | `docker-compose.yml` | T4 (11/11), 21:00 | T5 (12/11) | TV1 |
| `feat/hr-employee-form` | TV1 Duong | Giao diện HR tạo và sửa hồ sơ | PR code + e2e | T4 (11/11) | T5 (12/11) | TV2, TV4 |
| `feat/documents-api` | TV1 Duong | API tài liệu, upload presigned URL, lọc theo phạm vi, phiên bản; ADR-13 | PR code + e2e | T5 (12/11) | T6 (13/11) | TV2, TV3 |
| `infra/documents-email` | TV3 Bảo | Code Terraform: S3 tài liệu (CORS, IAM), email SES, alarm; chỉ `validate`/`plan` | `infra/` | T6 (13/11), 21:00 | T7 (14/11) | TV1 |
| `feat/document-search` | TV1 Duong | Worker trích văn bản, full-text PostgreSQL, tìm theo quyền; giao diện tài liệu | PR code + e2e | T6 (13/11) | T7 (14/11) | TV2, TV4 |
| `infra/idp-hardening` | TV3 Bảo | Siết cấu hình đăng nhập Cognito và Keycloak: tắt tự đăng ký, mật khẩu có chữ hoa, khóa sau 5 lần sai, thời hạn token và phiên (NFR-5.2, 5.3, 5.5, 5.9; thêm 13/11) | `infra/staging/cognito.tf`, `keycloak/realm-hr.json` | CN (15/11), 12:00 | T2 (16/11), 9:00 | TV1, TV4 |
| `docs/aws-rollout-plan` | TV3 Bảo | Kế hoạch lên AWS tuần 12–13: thứ tự, chi phí 2 tuần, rollback, dọn dẹp | `infra/README.md` | T7 (14/11), 21:00 | CN (15/11) | TV1 |
| `docs/test-cases-week10` | TV4 Duy | Ca kiểm thử tài liệu, tìm kiếm, hồ sơ, audit, quy tắc một quản lý | `docs/business/test-cases-tuan-10.md` | T5 (12/11), 21:00 | T6 (13/11) | TV2, TV1 |
| `feat/audit-ui`, `fix/auth-email-verified` | TV1 Duong | Màn hình xem audit; kiểm `email_verified` | PR code + e2e | T7 (14/11) | CN (15/11) | TV2 |
| `feat/leave-delegation` | TV1 Duong | BR-06 và BR-12 (mức 3, làm nếu còn thời gian) | PR code + e2e | CN (15/11), 12:00 | CN (15/11) | TV2, TV4 |
| `docs/test-report-week10` | TV4 Duy | Chạy ca kiểm thử trên `dev` (local) | `test-report-tuan-10.md` mục 2 | CN (15/11), 12:00 | T2 (16/11), 9:00 | TV1 |
| `docs/matrix-week10` | TV2 Thanh | Cập nhật ma trận phân quyền, trạng thái FR trong SRS (từ 12/11 FR chuyển từ BRD sang SRS) | `access-control-matrix.md`, `requirements/SRS.md` | CN (15/11), 12:00 | T2 (16/11), 9:00 | TV1 |

Thứ tự phụ thuộc:

1. T5: TV3 gửi `terraform plan` thật → TV1 đọc, ghi lỗi cần sửa trước tuần 12.
2. T3–T4: TV2 chốt quy tắc tài liệu → TV1 code API, TV4 viết ca kiểm thử.
3. T5: TV3 xong MinIO local → TV1 chạy thử upload.
4. T6–T7: TV1 xong tài liệu, tìm kiếm → TV4 kiểm thử trên local.
5. T2 (16/11), 9:00: mọi người điền "Việc đã làm". TV1 viết báo cáo, mở PR `dev` → `main`, gắn tag `week-10`.

## Chi tiết từng người

| Thành viên | File |
|---|---|
| TV1 (Duong, nhóm trưởng) | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | [TV4_Duy.md](TV4_Duy.md) |

## 1. Các công việc đã hoàn thành

_Điền cuối tuần._

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (Duong, nhóm trưởng) | | | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | | | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | | | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | | | [TV4_Duy.md](TV4_Duy.md) |

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 11: 16/11 – 23/11)

_Điền cuối tuần._ Kế hoạch tuần 11–13 đã chia theo từng tính năng (cập nhật 13/11):
[kế hoạch tổng mục 7](../tuan-04-ke-hoach-tong.md#7-kế-hoạch-theo-chức-năng-tuần-11--13). Bảng bảo mật dưới đây đã nằm trong mục 7.2.

**Việc bảo mật đã xếp sẵn cho tuần 11 (thêm 13/11).** Các việc này lấy từ những dòng "Chưa có" trong
[SRS mục 6.6](../../requirements/SRS.md#66-nfr-5--bảo-mật). Khi tạo thư mục `tuan-11`, TV1 chép bảng này vào kế hoạch tuần.

| Nhánh | Người | Việc | Yêu cầu (SRS) | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `feat/security-headers-ratelimit` | TV1 Duong | Header bảo mật (CSP, HSTS, `nosniff`, chặn iframe); giới hạn 100 request/phút cho mỗi người dùng, 20 request/phút cho tìm kiếm, vượt thì trả 429. Ngưỡng đặt qua biến môi trường | NFR-5.21, NFR-5.22 | T3 (17/11) | T4 (18/11) | TV3, TV4 |
| `infra/idp-mfa` | TV3 Bảo | MFA bằng ứng dụng TOTP. Keycloak: luồng đăng nhập bắt OTP với role `hr`, `admin`. Cognito: bật TOTP, đặt MFA bắt buộc cho tài khoản HR, ADMIN; ghi cách làm vào `infra/README.md` | NFR-5.4 | T5 (19/11), 21:00 | T6 (20/11) | TV1 |
| `docs/security-test-cases-week11` | TV4 Duy | Thêm ca kiểm thử: tự đăng ký, mật khẩu yếu, khóa sau 5 lần sai, hết phiên, MFA, 429, header bảo mật | NFR-5.2 → 5.5, 5.9, 5.21, 5.22 | T4 (18/11), 21:00 | T5 (19/11) | TV1, TV3 |

Thứ tự:

- **Rate limit trước load test.** `feat/security-headers-ratelimit` merge trước load test. Khi load test, dùng nhiều tài khoản
  hoặc nâng ngưỡng qua biến môi trường, để số đo NFR-1 không bị 429 làm sai.
- **Chốt MFA trước khi làm `infra/idp-mfa`.** Việc này cần chốt câu hỏi số 2 ở
  [SRS mục 8](../../requirements/SRS.md#8-vấn-đề-còn-mở): MFA có bắt buộc từ version 1 không.

## 3. Quyết định quan trọng

### Lùi thời điểm chạy staging trên AWS sang tuần 12–13 (10/11/2026)

**Quyết định của nhóm trưởng:** chỉ tạo tài nguyên AWS trong tuần 12 và 13. Tuần 10–11 làm và kiểm thử trên local (docker compose),
code Terraform chỉ dừng ở `validate` và `plan`.

**Lý do:** dự toán ~56,80 USD/tháng, sát hạn mức thẻ ~60 USD. Bật staging từ tuần 10 thì phải trả cho 4 tuần, phần lớn thời gian
không dùng. Chạy 2 tuần cuối giảm chi phí khoảng một nửa.

**Đánh đổi:**
- Tiêu chí của ADR-05 ("cuối tuần 10 demo được luồng nghỉ phép trên cloud") chuyển thành cuối tuần 12.
- Lỗi chỉ xuất hiện trên AWS (IAM, mạng, Cognito, SQS) phát hiện muộn. Giảm rủi ro bằng `plan` thật ở tuần 10 và kế hoạch triển
  khai chi tiết.
- Load test tuần 11 chạy trên local; tuần 12 chạy lại một lượt ngắn trên staging.
- Workflow deploy chỉ chạy tay cho tới tuần 12, để không báo lỗi trên mọi lần merge vào `dev`.

**Khi nào xem lại:** nếu đầu tuần 12 `apply` không thành công trong 1 ngày, nhóm báo thầy và dùng bản demo local.

### ADR-13 – Kho tài liệu: tải lên trực tiếp, tải xuống qua API, lọc phạm vi trong truy vấn

> Đã chuyển sang file riêng: [ADR-13 – Kho tài liệu: tải lên trực tiếp, tải xuống qua API, lọc phạm vi trong truy vấn](../../architecture/adr/ADR-13-document-storage.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).
