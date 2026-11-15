# UCn – Tên tính năng: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của tính năng.

## 1. Thành phần

| Thành phần | Phần của tính năng |
|---|---|
| API (`backend/src/modules/...`) | |
| Worker | |
| Web (`frontend/src/...`, route) | |
| Database (schema, migration) | |
| Dịch vụ ngoài | |

## 2. Biến môi trường

| Biến | Local | Staging | Thiếu thì sao |
|---|---|---|---|

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|

## 4. Các bước

Local và staging: các bước riêng ngoài quy trình chung (bucket, dữ liệu mẫu, cấu hình IdP…).

## 5. Kiểm tra sau deploy (smoke test)

1. Request hoặc thao tác giao diện, kết quả mong đợi.

## 6. Rollback và sự cố

Migration có revert được không, dữ liệu nào không lùi được, tính năng lỗi thì phần khác có chạy tiếp không.

## 7. Còn thiếu
