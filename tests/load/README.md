# Kiểm thử hiệu năng và chịu tải (k6)

> Đối chiếu yêu cầu phi chức năng: [SRS mục 6](../../docs/requirements/SRS.md#6-yêu-cầu-phi-chức-năng-nfr) (`NFR-1.1` → `NFR-1.3`, `NFR-2.1`, `NFR-2.4`).

## 1. Chuẩn bị môi trường local

1. Khởi động API ở chế độ nới giới hạn tần suất (`NFR-5.21`) để tránh mã lỗi `429` khi bắn `50 req/s`:
   ```powershell
   docker compose -f docker-compose.yml -f tests/load/docker-compose.loadtest.yml up -d api
   docker exec -it hr-platform-db-1 psql -U hr -d hr -c "DELETE FROM iam.rate_limit_counter;"
   ```
2. Đảm bảo dữ liệu mẫu đã được seed (`employee`, `manager`, `hr` trên Keycloak realm `hr`).

## 2. Cách chạy

- **Kiểm tra nhanh (30 giây, 10 req/s):**
  ```powershell
  k6 run -e LOAD_PROFILE=smoke tests/load/hrhelper-load.js
  ```
- **Chạy chuẩn nghiệm thu NFR-2.1 (15 phút, 50 req/s, tối đa 500 VU):**
  ```powershell
  k6 run -e LOAD_PROFILE=nfr tests/load/hrhelper-load.js
  ```
- **Khôi phục giới hạn tần suất mặc định sau khi đo xong:**
  ```powershell
  docker compose up -d api
  ```

## 3. Kết quả đo nghiệm thu

- **Ngày chạy:** 21/11/2026
- **Môi trường:** Docker local (Windows, 1 node: NestJS API, PostgreSQL 16, Keycloak, RabbitMQ)
- **Commit:** `e5399c8`
- **Kịch bản:** `LOAD_PROFILE=nfr` (1 phút tăng tải lên `50 req/s`, duy trì `50 req/s` trong `15 phút`, `30 giây` hạ tải; tổng `33.327` HTTP requests, `30.793` iterations).

| Tiêu chí | Chỉ số mục tiêu | Kết quả đo thực tế | Trạng thái |
  |---|---|---|---|
  | **NFR-1.1** (API đọc) | `p95 < 300 ms`, `p99 < 1.000 ms` | `p95 = 39,44 ms` (`avg = 54,73 ms`, `med = 7,16 ms`) | Đạt |
  | **NFR-1.2** (API ghi: tạo & hủy đơn nghỉ) | `p95 < 500 ms`, `p99 < 1.500 ms` | `p95 = 123,70 ms` (`avg = 83,50 ms`, `med = 15,86 ms`) | Đạt |
  | **NFR-1.3** (Tìm kiếm đồng nghiệp) | `p95 < 1.000 ms` | `p95 = 63,39 ms` (`avg = 61,01 ms`, `med = 9,61 ms`) | Đạt |
  | **NFR-2.1** (Chịu tải `50 req/s × 15 phút`) | Tỉ lệ lỗi `< 0,1%` | `16,49%` (`5.495 / 33.327` req lỗi; `99,42%` check nghiệp vụ đạt) | Chưa đạt (nghẽn Keycloak local) |
  | **NFR-2.4** (Tra cứu audit log) | `p95 < 1.000 ms` | `p95 = 36,61 ms` (`avg = 60,93 ms`, `med = 7,02 ms`) | Đạt |

### Ghi chú phân tích NFR-2.1
- Các endpoint nghiệp vụ của NestJS API đều xử lý nhanh (`p95` toàn bộ nhóm API đạt `55,78 ms`, tỉ lệ check nghiệp vụ đạt `27.790 / 27.951 = 99,42%`).
- Phần lớn trong `5.495` request lỗi phát sinh tại mốc phút thứ 8 khi các VU đồng loạt gọi `POST /realms/hr/protocol/openid-connect/token` để làm mới token (`~1.500` lượt xác thực password grant cùng lúc trên 1 container Keycloak local khiến `http_req_waiting` chạm timeout `60s`).
