# UCn – Tên use case

| Mục | Nội dung |
|---|---|
| Mục tiêu kinh doanh | MT-n (BRD) |
| Tác nhân chính | Vai trò khởi động use case |
| Tác nhân phụ, hệ thống ngoài | Vai trò hoặc hệ thống tham gia |
| Yêu cầu (SRS) | FR-n.1 → FR-n.m |
| Quy tắc | BR-nn, DR-nn, ADR-nn |
| Mức ưu tiên | M / S / C (MoSCoW) |
| Trạng thái | Đã có / Một phần / Kế hoạch tuần N |
| Phiên bản | 1.0 – dd/mm/yyyy |

## 1. Mô tả ngắn

Hai đến ba câu: ai làm gì, để đạt điều gì.

## 2. Tác nhân và quyền

| Tác nhân | Được làm gì trong use case này | Giới hạn theo dữ liệu |
|---|---|---|

## 3. Điều kiện

- **Điều kiện trước:** điều phải đúng trước khi bắt đầu.
- **Kích hoạt:** sự kiện hoặc thao tác bắt đầu use case.
- **Điều kiện sau khi thành công:** dữ liệu, trạng thái, audit, thông báo.
- **Điều kiện sau khi thất bại:** hệ thống giữ nguyên trạng thái nào.

## 4. Luồng chính

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | | |

## 5. Luồng thay thế

- **A1 (từ bước n):** …

## 6. Ngoại lệ

| Mã | Tình huống | Hệ thống phản hồi |
|---|---|---|
| E1 | | HTTP … `CODE` |

## 7. Quy tắc áp dụng

Link tới BR, DR, ADR; không chép lại nội dung.

## 8. Dữ liệu vào

| Trường | Bắt buộc | Kiểm tra |
|---|---|---|

## 9. Giao diện và API

| Bước | Màn hình | API |
|---|---|---|

## 10. Yêu cầu phi chức năng liên quan

NFR-n.m áp dụng riêng cho use case này.

## 11. Kiểm thử

Xem `test.md`. Mục này chỉ link, không chép lại.

## 12. Hiện trạng và việc còn lại

Phần đã có trên `dev`, phần thiếu. Ai làm, tuần nào: mục 4 của `requirements.md`.

## 13. Thiết kế đề xuất cho phần chưa có

Với tính năng chưa code: API, dữ liệu, màn hình đề xuất để có chỗ bám. Người code chốt và sửa mục này trong PR.
