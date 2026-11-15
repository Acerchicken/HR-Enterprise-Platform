# Biên bản kiểm thử chức năng – Tuần 10

- **Ngày thực hiện:** 15/11/2026
- **Nhánh / Commit:** Nhánh `docs/test-report-week10` (Cập nhật theo các PR đã merge tuần 10: `#60`, `#63`, `#64`, `#76`)
- **Môi trường:** Local (`docker compose up -d --build`), Web `http://localhost:5173`, Swagger `http://localhost:3000/api/docs`
- **Người thực hiện:** Duy (TV4)

## 1. Kết quả kiểm tra và đối chiếu tài liệu tính năng (Tuần 10)

| Hạng mục / Use Case | PR liên quan | Nội dung / Trọng tâm kiểm tra | Trạng thái | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Đặc tả Use Case (UC1 – UC7)** | `#76` | Review 7 file `test.md` và cấu trúc 4 file đặc tả (requirements, spec, deploy, test) cho UC1–UC7. | Đã hoàn thành | Đã đối chiếu bảng phủ AC, xác định các ca còn thiếu cho TV4. |
| **Các tính năng nền tảng** | `#60`, `#63`, `#64` | Kiểm tra tích hợp các PR thành phần đã merge vào nhánh `dev`. | Đã tích hợp | Các unit test cơ bản và e2e đã chạy ổn định trên nhánh `dev`. |

## 2. Phạm vi kiểm thử chi tiết theo Use Case (UC1 – UC7)
- **UC1 (Hồ sơ nhân viên):** Đã kiểm tra các unit test phân quyền (`employee-access.spec.ts`), mã hóa AES (`field-crypto.spec.ts`). Các ca nâng cao chờ hoàn thiện nhánh `feat/profile-layout`.
- **UC2 (Tổ chức):** Đã đối chiếu unit test chặn vòng cây tổ chức và danh bạ.
- **UC3 & UC4 (Đơn nghỉ phép):** Đã kiểm tra logic state machine, quy tắc ngày lễ và worker thông báo.
- **UC5 & UC7 (Kho tài liệu & Audit log):** Đã kiểm tra cơ chế append-only của audit log ở database và quy tắc lọc file.