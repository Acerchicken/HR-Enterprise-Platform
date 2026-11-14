# Giao diện chung (khung trang, trang chủ, điều hướng)

| Mục | Nội dung |
|---|---|
| Phạm vi | Phần giao diện dùng chung cho mọi use case: thanh trên, trang chủ, thanh tìm kiếm, popup xem nhanh hồ sơ, quy ước chung |
| Không gồm | Màn hình riêng của từng use case: xem mục 9 "Giao diện và API" trong `spec.md` của UC đó |
| Liên quan | [UC1 mục 9.1](UC1-employee-profile/spec.md#91-bố-cục-trang-hồ-sơ) (bố cục hồ sơ, màu), [UC6](UC6-self-service-search/spec.md) (tìm kiếm), [SAD phần 2 mục 9](../architecture/SAD-2-software-architecture.md#9-frontend) (kỹ thuật frontend) |
| Trạng thái | Đề xuất, chờ TV1 chốt các điểm ở mục 7 |
| Phiên bản | 0.1 – 14/11/2026 |

**Vì sao tách file này:** mỗi `spec.md` đã có mục 9 mô tả màn hình của use case đó, và nên giữ ở đó để người làm một UC
đọc một chỗ. Nhưng thanh trên, trang chủ, tìm kiếm không thuộc riêng UC nào; nếu chép vào từng UC sẽ lệch nhau. Vì vậy:
phần chung ở file này, phần riêng ở mục 9 của từng UC, hai bên link nhau.

## 1. Sơ đồ màn hình

```text
Đăng nhập ─► Trang chủ (/)
              ├─ Thanh trên: logo · tìm kiếm · ảnh đại diện
              │    ├─ Tìm kiếm ─► chọn người ─► Popup xem nhanh hồ sơ ─► "Xem hồ sơ đầy đủ" ─► /employees/:id
              │    └─ Ảnh đại diện ─► menu: Hồ sơ của tôi · Đăng xuất
              └─ Ô chức năng ─► trang riêng của từng chức năng (bảng mục 3)
                   └─ "Hồ sơ của tôi" ─► /employees/:id (hồ sơ đầy đủ, UC1)
```

## 2. Thanh trên (mọi trang sau khi đăng nhập)

| Vị trí | Thành phần | Hành vi |
|---|---|---|
| Trái | Logo, chữ "HRHelper" | Bấm về trang chủ `/` |
| Giữa | Thanh tìm kiếm | Mục 4 |
| Phải | Ảnh đại diện (chưa có ảnh thì chữ cái đầu của tên) | Bấm mở menu: tên, vai trò, "Hồ sơ của tôi", "Đăng xuất" |

- Thanh trên **luôn hiện** ở mọi trang, không chỉ trang chủ, để người dùng tìm kiếm, về trang chủ, đăng xuất từ bất kỳ đâu.
- Màn hình hẹp (< 640 px): thanh tìm kiếm thu thành biểu tượng kính lúp, bấm mới mở ô nhập toàn chiều ngang.
- Dữ liệu: chỉ `GET /me` (tên, vai trò, `employeeId`, ảnh). Không gọi API nào khác để dựng thanh trên.

## 3. Trang chủ `/`

Giữa trang là lưới ô chức năng (thẻ có biểu tượng, tên, một dòng mô tả). Bấm ô nào thì sang trang riêng của chức năng đó.
Ô hiện **theo vai trò**: người không có quyền thì không thấy ô, không hiện rồi báo lỗi.

| Ô | Vai trò thấy | Mở | UC | Trạng thái |
|---|---|---|---|---|
| Hồ sơ của tôi | Mọi người | `/employees/:id` (id của mình) | UC1 | Đã có (đang ở `/`) |
| Tra cứu đồng nghiệp | Mọi người | `/directory` | UC2, UC6 | Đã có |
| Sơ đồ tổ chức | Mọi người | `/org` | UC2 | Đã có |
| Đăng ký nghỉ | Mọi người | `/leave/new` | UC3 | Đã có |
| Đơn nghỉ của tôi (kèm số dư phép) | Mọi người | `/leave` | UC3 | Đã có |
| Duyệt đơn nghỉ | MANAGER, HR | `/leave/approvals` | UC4 | Đã có |
| HR hoàn tất đơn | HR | `/leave/hr` | UC4 | Đã có |
| Yêu cầu cập nhật hồ sơ | HR | `/hr/change-requests` | UC1 | **Chưa có** |
| Thêm nhân viên | HR | `/employees/new` | UC1 | Đã có (nút trong danh bạ) |
| Kho tài liệu | Mọi người | `/documents` | UC5 | **Chưa có** |
| Lịch sử thao tác | HR, ADMIN | `/audit` | UC7 | **Chưa có** |

- **Số đếm trên ô:** "Duyệt đơn nghỉ" và "Yêu cầu cập nhật hồ sơ" hiện số việc đang chờ (badge), để người duyệt biết có
  việc mà không phải mở từng trang. Mỗi số lấy từ trường `total` của API danh sách tương ứng với `size=1`, chỉ gọi cho vai trò
  thấy ô đó.
- **Ô chưa làm:** cùng quy ước với [UC1 mục 9.1](UC1-employee-profile/spec.md#91-bố-cục-trang-hồ-sơ): tiêu đề đỏ, nhãn
  "Chưa có", bấm mở trang "Chức năng đang phát triển". Khi lên bản thật cho người dùng cuối thì ẩn hẳn các ô này.
- Trang chủ không tải dữ liệu nghiệp vụ nào khác (không tải hồ sơ, không tải danh sách đơn), theo nguyên tắc tải theo nhu cầu.
- Trang chức năng có thanh trên như mọi trang, thêm dòng "← Trang chủ" (breadcrumb) phía trên tiêu đề.

## 4. Thanh tìm kiếm

| Bước | Người dùng | Hệ thống |
|---|---|---|
| 1 | Gõ từ 2 ký tự | Chờ người dùng ngừng gõ 300 ms rồi mới gọi `GET /employees?q=…&size=8` (UC6 luồng 4.1) |
| 2 | | Hiện danh sách gợi ý dưới ô: ảnh, họ tên, chức danh, phòng ban. Không có kết quả thì hiện "Không tìm thấy" |
| 3 | Chọn một người (chuột, hoặc phím ↑ ↓ rồi Enter) | Mở popup xem nhanh hồ sơ người đó (mục 5) |
| 4a | Nhấn Enter khi chưa chọn dòng nào | Mở `/directory?q=…` với đầy đủ kết quả, phân trang |
| 4b | Nhấn Esc | Đóng danh sách gợi ý |

- Chờ ngừng gõ và giới hạn 8 gợi ý để không vượt giới hạn 20 lượt tìm mỗi phút (NFR-5.21) và giữ p95 < 1 s (NFR-1.3).
- Khi có tìm tài liệu (UC6 luồng 4.2), danh sách gợi ý chia hai nhóm "Nhân viên" và "Tài liệu".
- Phím tắt `/` đưa con trỏ vào ô tìm kiếm (tùy chọn).

## 5. Popup xem nhanh hồ sơ

Mở khi chọn một người trong thanh tìm kiếm (và có thể khi bấm tên người trong danh bạ, sơ đồ tổ chức, đơn nghỉ).

| Phần | Nội dung |
|---|---|
| Đầu popup | Ảnh, mã nhân viên, họ tên, chức danh, phòng ban |
| Liên hệ | Số điện thoại, email công ty (nút sao chép, nút gọi/gửi mail) |
| Quản lý trực tiếp | Tên, bấm mở popup của người đó |
| Chân popup | Nút "Xem hồ sơ đầy đủ" mở `/employees/:id`; nút "Xem trên sơ đồ tổ chức" mở `/org` tại phòng ban |

- **Chỉ dữ liệu mức danh bạ** (UC1 mục 9.1 "Theo người xem"), lấy từ một lần gọi `GET /employees/{id}/summary`. Không gọi
  API mục nào, không có giá trị nhạy cảm, không có nút sửa. Phần chi tiết hơn (theo quyền người xem) nằm ở trang hồ sơ đầy đủ.
- Đóng bằng nút X, phím Esc, bấm ra ngoài popup. Mở popup thì con trỏ bàn phím nằm trong popup (focus trap), đóng thì trả về ô
  tìm kiếm; popup có `role="dialog"`, `aria-modal="true"`.
- Màn hình hẹp (< 640 px): popup thành tấm trượt từ dưới lên (bottom sheet), chiếm gần hết chiều cao.
- Popup **không đổi URL**; muốn gửi link cho người khác thì dùng link hồ sơ đầy đủ.

## 6. Quy ước chung

- **Màu, nhãn "Chưa có", giá trị nhạy cảm `********` + mắt:** theo [UC1 mục 9.1](UC1-employee-profile/spec.md#91-bố-cục-trang-hồ-sơ),
  áp cho toàn ứng dụng.
- **Tải theo nhu cầu:** trang nào chỉ gọi API cho phần đang hiện; mục, tab, popup chỉ tải khi được mở.
- **Quyền:** ẩn ô, nút theo vai trò chỉ để tiện dùng; quyền thật do backend kiểm (SAD phần 2 mục 9).
- **Đang tải, lỗi:** khung xám (skeleton) khi đang tải; lỗi hiện `ErrorBox` kèm `traceId`.
- **Rộng tối đa:** trang hồ sơ 720 px (UC1); trang danh sách, bảng (đơn nghỉ, danh bạ, audit) tối đa 1200 px.

## 7. Góp ý cho thiết kế ban đầu và điểm cần chốt

Thiết kế ban đầu (14/11): thanh trên có tìm kiếm và ảnh đại diện; giữa trang là ô chức năng, bấm sang trang mới; riêng "Hồ
sơ" và tra cứu hồ sơ trên thanh tìm kiếm mở popup chứa hồ sơ.

| Ý | Đánh giá | Đề xuất |
|---|---|---|
| Thanh trên có tìm kiếm, ảnh đại diện | Đúng cách làm phổ biến | Thêm logo về trang chủ; menu ảnh đại diện có "Hồ sơ của tôi", "Đăng xuất". Sau này có thể thêm chuông thông báo (đơn chờ duyệt) |
| Trang chủ là lưới ô chức năng | Hợp với ứng dụng tự phục vụ nhân sự, người dùng ít vào, cần thấy ngay việc làm được | Lọc ô theo vai trò, có số việc chờ trên ô. Giữ thanh trên ở mọi trang để không phải quay về trang chủ mỗi lần đổi chức năng |
| Bấm ô chức năng thì sang trang mới | Đúng | Mỗi trang có URL riêng để Back, gửi link, tải lại hoạt động đúng |
| **Hồ sơ đầy đủ mở trong popup** | **Không nên.** Hồ sơ có ~17 mục, mỗi mục có trang con, form sửa, tải file, khung "chờ HR xác nhận". Popup hợp với nội dung ngắn, một việc; nội dung nhiều tầng trong popup gặp lỗi: nút Back của trình duyệt thoát khỏi popup hoặc rời trang, không gửi link được, popup lồng popup, khó dùng trên điện thoại, khó cho người dùng bàn phím, trình đọc màn hình | "Hồ sơ của tôi" mở **trang** `/employees/:id`. Tra cứu trên thanh tìm kiếm mở **popup xem nhanh** (mục 5) với dữ liệu mức danh bạ, có nút "Xem hồ sơ đầy đủ". Cách này giống thẻ người trong Teams, Outlook, và khớp nguyên tắc tải theo nhu cầu: popup chỉ gọi một API, chỉ dữ liệu ai cũng được xem |

**Cần TV1 chốt:**

1. Popup xem nhanh + trang hồ sơ đầy đủ (đề xuất) hay giữ hồ sơ đầy đủ trong popup. Nếu giữ popup đầy đủ thì tối thiểu phải:
   popup có URL riêng (`/employees/:id` hiện đè lên trang đang xem, Back thì đóng), mục con mở ngay trong popup có nút quay
   lại, điện thoại thì popup toàn màn hình.
2. Ảnh mẫu bố cục popup: đưa vào `docs/features/assets/` và link từ mục 5.
3. Có ẩn ô "Chưa có" trên bản demo cuối kỳ không.

## 8. Hiện trạng và việc còn lại

| Nội dung | Trạng thái (dev, 14/11) | Việc còn lại |
|---|---|---|
| Thanh trên | Có logo, menu chữ (Hồ sơ của tôi, Danh bạ, Sơ đồ tổ chức, Nghỉ phép, Duyệt đơn, HR hoàn tất), tên, vai trò, Đăng xuất (`components/Layout.tsx`) | Thay menu chữ bằng tìm kiếm + menu ảnh đại diện |
| Trang chủ ô chức năng | Chưa có; `/` đang là trang hồ sơ của tôi | Tạo `HomePage`, chuyển hồ sơ của tôi sang `/employees/:id` |
| Thanh tìm kiếm, popup xem nhanh | Chưa có; tìm ở trang `/directory` | Làm theo mục 4, 5; dùng lại `GET /employees?q=` và `GET /employees/{id}/summary` |
| Ảnh đại diện | Chưa có (UC1) | Hiện chữ cái đầu cho tới khi có ảnh |
| Kiểm thử | – | TV4 thêm ca: ô theo từng vai trò, tìm kiếm bằng bàn phím, đóng popup bằng Esc, màn hình hẹp |
