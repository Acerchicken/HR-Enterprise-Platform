# Biên bản kiểm thử UC1 – Hồ sơ nhân viên

- **Nhánh:** `docs/test-report-uc1` (tách từ `dev`)
- **Ngày lập biên bản:** 21/11/2026
- **Môi trường chạy unit test:** Máy local Windows (`D:\Downloads\HR-Enterprise-Platform\backend`), lệnh `npm test -- employee` (`jest employee`).
- **Tài liệu tham chiếu:** `docs/features/UC1-employee-profile/test.md`, `docs/features/UC1-employee-profile/requirements.md`, `docs/requirements/SRS.md`

## 1. Kết quả đã chạy thực tế (`npm test -- employee`)

- **Tổng kết:** **9/9 test suites passed**, **38/38 tests passed**, thời gian chạy **116.435 s**.
- **Các file test đã qua:**
  - `src/modules/employee/profile-schema.spec.ts` (78.092 s)
  - `src/modules/employee/transfer-rules.spec.ts` (78.095 s)
  - `src/modules/employee/profile-computed.spec.ts` (78.748 s)
  - `src/modules/employee/employee-audit.spec.ts` (79.935 s)
  - `src/modules/employee/profile-file-rules.spec.ts` (79.943 s)
  - `src/modules/employee/employee-access.spec.ts` (81.585 s)
  - `src/modules/employee/profile-sections.spec.ts` (90.496 s)
  - `src/modules/employee/employee-fields.spec.ts` (102.023 s)
  - `src/modules/employee/profile-change.service.spec.ts` (110.361 s)
- **Ghi chú kỹ thuật:** Sau khi hoàn tất 38/38 tests, Jest ghi nhận một worker process không thoát êm và bị force exit (`--detectOpenHandles` / active timers chưa `unref()`).

## 2. Phạm vi chưa chạy trên phiên này / ca còn thiếu

- **E2E (`npm run test:e2e`):** Chưa chạy trên phiên này.
- **Ca đơn lẻ & kiểm tay giao diện theo `test.md`:** `AC-1.3.3` (HR mở hồ sơ không kèm `include=sensitive` không sinh `VIEW_SENSITIVE`), `AC-1.5.3` (tạo trùng mã/email trả `409`), `AC-1.4.2` cùng các ca kiểm tay giao diện (375 px / 1280 px, tab Network, Mailpit, hộp xác nhận nghỉ việc) chưa thực hiện/ghi nhận mới.
- **Tích hợp hạ tầng & NFR:** `AC-1.10.7` (lifecycle 30 ngày trên MinIO/S3 thật), `AC-1.14.5`, `NFR-1.1`, `NFR-5.18`, `NFR-5.21` chưa đo đạc/kiểm chứng trên môi trường staging/2 instance.
