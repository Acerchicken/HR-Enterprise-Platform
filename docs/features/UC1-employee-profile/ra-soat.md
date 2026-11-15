# UC1 – Rà soát hiện trạng và kế hoạch `feat/profile-layout`

> Rà ngày 14/11/2026 trên `dev` (commit `e3a44fa`), trước khi mở nhánh `feat/profile-layout`. So code và database với
> [requirements.md](requirements.md), [spec.md](spec.md) mục 9.1 và [giao diện chung](../frontend.md) mục 2, 4, 5, 10.
> Lịch làm: [kế hoạch tổng mục 7.4](../../progress/ke-hoach-tong.md#74-bước-1--uc1-cn-1511--t2-2311).

## 1. Kết luận

- **Không viết lại.** Backend (module `employee`, `FieldCrypto`, audit, guard) dùng tiếp. Phần làm mới chủ yếu là API
  `summary`, API từng mục và toàn bộ khung giao diện (nav bar, trang chủ, popup hồ sơ).
- **Nhánh `feat/profile-layout` không có migration.** Dữ liệu trang mặc định (mã, tên, chức danh, phòng ban, quản lý, điện
  thoại, email) đã có trong `employee.employee`. Bảng `profile_item`, `profile_file`, `profile_change_request` và cột
  `avatar_file_id` thuộc `feat/profile-change-requests`, `feat/profile-files` (migration mới, không sửa migration cũ).
- **Lỗi lớn nhất là AC-1.8.7:** `GET /me` và `GET /employees/{id}` trả ngày sinh, địa chỉ ngay khi mở trang; trang "Hồ sơ
  của tôi" còn tải số dư phép.

## 2. Quyết định 14/11/2026

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Tên nhánh `feat/profile-self-service` dễ nhầm với UC6 (tra cứu tài liệu) | Đổi tên thành `feat/profile-change-requests` (yêu cầu cập nhật hồ sơ, HR duyệt, FR-1.9). UC6 không đổi |
| 2 | Ô tìm kiếm trên nav bar | **Chỉ tìm đồng nghiệp**, làm trong `feat/profile-layout`. Tìm tài liệu và trợ lý AI ở trang riêng "Tra cứu tài liệu" (`/documents`), mở bằng ô chức năng ở trang chủ; ô "Tài liệu" và "Hỏi trợ lý chính sách" gộp thành một ô. Đã sửa [frontend.md](../frontend.md) 1.3, UC6, SRS, BRD, bản vẽ |
| 3 | Bộ biểu tượng | `lucide-react` |
| 4 | Trang con "Thông tin cá nhân" trước khi có `feat/profile-change-requests` | Giữ cách lưu thẳng điện thoại, địa chỉ như hiện tại (TV1 chốt 14/11); đổi sang "Gửi yêu cầu" ở nhánh đó |
| 5 | Mục "Các mốc trong công ty" | `available: false` (tiêu đề đỏ) vì thâm niên, mốc chưa tính; ngày vào làm xem trong "Thông tin cá nhân" |
| 6 | Danh sách cấp dưới trực tiếp ở `EmployeePage` cũ | Bỏ khỏi popup (bản vẽ không có); xem ở sơ đồ tổ chức |

## 3. Database

| Thành phần | Hiện trạng | So với spec | Xử lý |
|---|---|---|---|
| `employee.employee` | Đủ trường 8.1 trừ ảnh; có `version` | Thiếu `avatar_file_id` | `feat/profile-files`. Nhánh này hiện chữ cái đầu |
| `employee.employee_sensitive` | `national_id_enc`, `bank_account_enc`, `salary_enc` (một giá trị) | Lương chưa có lịch sử; tài khoản chỉ có số, chưa có ngân hàng, chi nhánh, chủ tài khoản | Dùng nguyên cho mục `salary`, `bank-account`; mở rộng sau |
| `profile_item`, `profile_file`, `profile_change_request` | Chưa có | Spec 13.1 | `feat/profile-change-requests`, `feat/profile-files` |
| Hợp đồng ("Diện đối tượng") | Chưa có dữ liệu | Hàng ở đầu trang, mức QL | `summary` trả `contractType: null`, hàng đỏ "Chưa có" |
| `ix_employee_search` | Trigram trên `lower(full_name ‖ email ‖ code)` | "ngu" khớp "Nguyễn", "nguyen" không dấu không khớp | Ghi nhận; thêm `unaccent` bằng migration mới khi cần |

## 4. Backend

| Chỗ | Hiện trạng | Khoảng trống | AC |
|---|---|---|---|
| `GET /me` | Trả cả hồ sơ | Chỉ trả tài khoản, vai trò, `employeeId` | AC-1.8.7 |
| `GET /employees/{id}/summary` | Chưa có | Phần trang mặc định hiện + danh sách mục (`available`, `pendingRequests`), dưới 4 KB | AC-1.8.1, 1.8.4, 1.8.7 |
| `GET /employees/{id}/profile/{section}` | Chưa có | Dữ liệu từng mục, chỉ khi bấm; mục không được xem trả 404 | AC-1.8.6, 1.8.8 |
| `viewLevel()` | 3 mức: `HR`, `PERSONAL` (gộp chủ hồ sơ và quản lý), `PUBLIC` | Spec có DB, QL, CN, NC, HR; tách chủ hồ sơ khỏi quản lý trực tiếp | AC-1.8.4 |
| Danh mục mục | Chưa có | Một file mô tả mục dùng chung cho `summary` và API mục (spec 13.1, 13.2) | AC-1.8.2 |
| Chủ hồ sơ xem lương, số tài khoản | `include=sensitive` chỉ cho HR | Bấm mắt xem của mình, audit `VIEW_SENSITIVE`; không xem CCCD | AC-1.3.5 |
| `GET /employees/{id}` | Trả hồ sơ theo mức cũ | Giữ cho form sửa của HR | – |
| Form HR tự tải `include=sensitive` | Có | Chỉ tải khi bấm mắt | AC-1.3.4, `fix/employee-org-integrity` |
| `GET /me/todo-counts` | Chưa có | Số trên chuông | `feat/app-shell-todo` |

Thấy khi rà nhưng thuộc `fix/employee-org-integrity`: chưa bắt buộc `version` (AC-1.6.2), audit `UPDATE` ghi giá trị mới của mọi
trường thường (AC-1.4.3), chưa chặn người `TERMINATED` (AC-1.7.2).

## 5. Frontend

| Chỗ | Hiện trạng | Khoảng trống |
|---|---|---|
| `styles.css` | `--primary: #2457c5`; thiếu `--todo`, `--warn`, `--accent`, `--primary-soft` | Bảng màu frontend.md 5.1 (AC-1.8.3) |
| `Layout.tsx` | Chữ HRHelper, 6 link, tên + nhãn vai trò, Đăng xuất | Logo, ô tìm đồng nghiệp, chuông, menu ảnh đại diện (AC-0.1.1) |
| Trang chủ `/` | Đang là `ProfilePage` | Lời chào, "Việc cần làm", lưới ô theo vai trò, số dư phép (AC-0.2.1) |
| `ProfilePage.tsx` | Thẻ rời, form sửa liên hệ, bảng số dư phép | Bỏ; thay bằng popup `/me/profile` |
| `EmployeePage.tsx` | Trang riêng, nút "Xem trường nhạy cảm" | Popup drawer 720 px / toàn màn hình, có URL, trang con, `MaskedValue` (AC-0.3.x, 0.4.1) |
| Thẻ xem nhanh | Chưa có | `QuickViewCard`, chỉ gọi `summary` (AC-0.3.0) |
| Thành phần dùng chung | Chỉ có `ErrorBox` | `NavBar`, `SearchBox`, `NotificationBell`, `AvatarMenu`, `FeatureTile`, `ProfilePanel`, `SectionRow`, `MaskedValue`, `Skeleton`, `EmptyState` |
| `useApi` | Không cache | Không gọi lại `summary` trong 60 giây (spec 4.1 bước 2a) |
| Test frontend | Không có | Playwright ở 375 px, 1280 px, đếm request (AC-1.8.7, 1.8.8) |

## 6. Kế hoạch `feat/profile-layout`

Một nhánh từ `dev`, mở PR nháp sau commit đầu, mỗi bước một commit. Nếu chậm so với hạn merge T3 (17/11), tách bước 1–2
thành PR backend riêng để merge trước.

| Bước | Việc | File chính | AC |
|---|---|---|---|
| 1 | Danh mục mục `profile-sections.ts` (mã, nhóm, mức, ai nhập, `available`); `viewLevel` tách `OWNER`, `MANAGER`; `canAccess(viewer, employee, section)`; unit test vai trò × mục | `backend/src/modules/employee/` | 1.8.2, 1.8.4, 1.8.6 |
| 2 | `GET /employees/{id}/summary`; `GET /employees/{id}/profile/{section}` cho `personal`, `salary`, `bank-account` (`?reveal=true` mới giải mã, ghi `VIEW_SENSITIVE`); mục chưa có trả 404. `GET /me` còn `{ email, roles, employee: { id, employeeCode, fullName } }` (giữ `employee.id` cho e2e và trang đơn nghỉ). Cập nhật e2e, `openapi.yaml`, `schema.d.ts` | `employee.controller.ts`, `employee.service.ts`, `employee.dto.ts`, `test/app.e2e-spec.ts` | 1.8.7, 1.8.8, 1.3.5 |
| 3 | Biến màu 5.1, `Skeleton`, `EmptyState`, `SectionRow`, `MaskedValue`, `lucide-react`; cache 60 giây cho `summary` | `frontend/src/styles.css`, `components/` | 1.8.3 |
| 4 | `NavBar` (logo, `SearchBox` chỉ tìm đồng nghiệp, `NotificationBell` chưa có số, `AvatarMenu`); `HomePage` với ô theo vai trò, ô chưa làm đỏ "Chưa có", ô "Tra cứu tài liệu" đỏ; đường dẫn cũ vẫn chạy | `Layout.tsx`, `pages/HomePage.tsx`, `App.tsx` | 0.1.1, 0.1.2, 0.2.1, UC6 6.1.x |
| 5 | `ProfilePanel` theo route nền cho `/me/profile`, `/employees/:id`, `/employees/:id/:section`; Back, Esc, X, bấm nền để đóng; focus trap. Trang con `personal`, `salary`, `bank-account`; mục khác mở trang "Chức năng đang phát triển", không gọi API. `QuickViewCard` từ ô tìm kiếm, danh bạ, sơ đồ tổ chức | `components/ProfilePanel.tsx`, `pages/profile/` | 1.8.1, 1.8.2, 1.8.5, 0.3.x, 0.4.1 |
| 6 | Unit + e2e backend; Playwright chụp 375 px, 1280 px, đếm request; ghi mã AC trong mô tả PR | – | – |

Ngoài phạm vi (đã có nhánh riêng): yêu cầu cập nhật và màn hình duyệt (`feat/profile-change-requests`), file và ảnh đại diện
(`feat/profile-files`), số trên chuông (`feat/app-shell-todo`), trang "Tra cứu tài liệu" (`feat/document-search`,
`feat/policy-assistant`), giới hạn tần suất (`feat/security-headers-ratelimit`).
