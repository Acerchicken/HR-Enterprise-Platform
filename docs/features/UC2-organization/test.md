# UC2 – Thông tin tổ chức: kiểm thử

> Tiêu chí: [requirements.md](requirements.md). Cách chạy chung, tài khoản mẫu: [README](../README.md#kiểm-thử).

## 1. Chiến lược

Rủi ro chính: cây tổ chức sai (vòng, nhiều gốc) làm sai người duyệt đơn ở UC4, và danh bạ lộ người đã nghỉ việc. Unit test kiểm
thuật toán chặn vòng; e2e kiểm cây, quy tắc một quản lý; ca SEC kiểm quyền tạo, sửa phòng ban.

## 2. Test tự động đã có

| Mức | File | Nội dung |
|---|---|---|
| Unit | `backend/src/modules/organization/organization.service.spec.ts` | Chặn vòng khi đổi phòng ban cha |
| Unit | `backend/src/common/ttl-cache.spec.ts` | Cache danh sách phòng ban |
| e2e | `backend/test/app.e2e-spec.ts` | Danh bạ, cây, nhóm "quản lý trực tiếp và CEO", "ma trận phân quyền" |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động (e2e, tên test) | Ca tay | Trạng thái |
|---|---|---|---|
| AC-2.1.1 | "danh bạ tìm kiếm và phân trang" (theo tên) | Cần thêm theo mã, email | Một phần |
| AC-2.1.2 | – | Cần thêm | Chưa |
| AC-2.1.3 | – | Cần thêm | Chưa |
| AC-2.1.4 | – | Cần thêm (`size = 101`) | Chưa |
| AC-2.2.1, AC-2.2.3 | "cây tổ chức có 1 gốc loại Công ty, mỗi đơn vị có loại, trưởng, số người" | – | Có |
| AC-2.1.5 | "lọc danh bạ theo đơn vị mặc định gồm đơn vị con" | – | Có |
| AC-2.1.6 → AC-2.1.9 | – (ô tìm trên nav bar, frontend AC-0.1.2) | Ca tay: gợi ý 5 người, Enter, thẻ xem nhanh | Ca tay |
| AC-2.4.8, AC-2.4.9 | "luật loại cha, loại con"; unit test `organization.service.spec.ts` | – | Có |
| AC-2.9.4 | "chi tiết đơn vị có đường dẫn từ gốc và trưởng"; phó ở "trưởng, phó thuộc đơn vị…" | Xem giao diện | Có |
| AC-2.9.1, AC-2.9.5, AC-2.9.6 | "trưởng, phó thuộc đơn vị hoặc đơn vị cha, đang làm việc, không quá số phó" | – | Có |
| AC-2.9.8 | "nghỉ việc gỡ vai trò trưởng, phó trong cùng giao dịch, có audit" | – | Có |
| AC-2.10.1, AC-2.10.2 | "ngừng hoạt động: còn người hoặc đơn vị con thì 409; …" | – | Có |
| AC-2.6.1, AC-2.6.2, AC-2.6.3 | "chức danh: HR tạo, ngừng dùng; CEO là chức danh hệ thống" | – | Có |
| AC-2.9.2 | – | Tạo nhân viên ở Nhóm chưa có trưởng: gợi ý trưởng đơn vị cha | Ca tay |
| AC-2.9.3 | – | Chờ UC4 phân công duyệt thay | Chưa có tính năng |
| AC-2.10.3 | – | Ca tay: điều chuyển hết người rồi ngừng hoạt động | Ca tay |
| AC-2.2.2, AC-2.3.1 | "thành viên phòng ban và nhân viên trực thuộc" | – | Có |
| AC-2.4.1, AC-2.4.4 | "nhân viên không tạo được phòng ban; HR tạo được", "tạo, sửa phòng ban: HR và ADMIN…" | SEC-05 → SEC-16 | Có |
| AC-2.4.2 | "tạo, sửa phòng ban: … không tạo được vòng lặp" | – | Có |
| AC-2.4.3 | – | Cần thêm | Chưa |
| AC-2.4.5 | – | Thêm, sửa đơn vị trên Sơ đồ tổ chức; lỗi luật cha con hiện dưới ô Đơn vị cha | Ca tay |
| AC-2.4.6, AC-2.4.7 | "cây tổ chức chỉ một gốc; trưởng đơn vị phải đang làm việc" | – | Có (AC-2.4.7 phần kiểm thuộc đơn vị chờ nhánh 2) |
| AC-2.5.1 | "tạo nhân viên không phải CEO mà thiếu quản lý → 400; tạo CEO thứ hai → 400" | – | Có |
| AC-2.5.2 | "HR không gán được quản lý tạo vòng lặp" | – | Có |
| AC-2.7.1, AC-2.7.4 | "hiệu lực hôm nay đổi ngay; quá 30 ngày hoặc trước ngày vào làm thì 400" | – | Có |
| AC-2.7.2 | "hiệu lực tương lai: \"Sắp hiệu lực\", hủy được, một người chỉ một điều chuyển chờ; job áp dụng khi tới ngày" | Đo thời gian thật trên staging: tạo điều chuyển ngày mai, kiểm lúc 00:15 | Có |
| AC-2.7.3 | Đơn nghỉ đi theo `manager_id` hiện tại (test UC4 "quản lý duyệt") | Email cho quản lý mới | Một phần |
| AC-2.7.5, AC-2.7.6 | "cấp dưới: phải chọn cho từng người; …; trưởng đơn vị cũ phải chọn người thay" | Giao diện: "Chuyển tất cả sang …" | Có |
| AC-2.7.7, AC-2.8.3 | "tạo nhân viên có dòng \"Tuyển mới\"; sửa phòng ban qua PATCH bị chặn" | – | Có |
| AC-2.7.8 | "job kiểm lại quy tắc: đơn vị đích đã ngừng hoạt động thì FAILED" | Thông báo HR khi `FAILED` | Một phần |
| AC-2.8.1, AC-2.8.2 | "quá trình công tác…" (UC1, đọc từ bảng mới) | Xem giao diện: lý do, nhãn "Sắp hiệu lực" | Có |
| UC1 AC-1.7.3, AC-2.9.8 | "nghỉ việc: là quản lý mới trong điều chuyển chờ thì 400; hộp xác nhận nêu trước; hủy điều chuyển chờ của người nghỉ" | Giao diện hộp xác nhận nghỉ việc | Có |
| AC-2.5.3 | "gán quản lý đã nghỉ việc → 400; gán quản lý cho CEO → 400; bỏ quản lý của nhân viên → 400" | – | Có |

## 4. Dữ liệu và tài khoản

Seed tạo 28 đơn vị (gốc Công ty mã `HQ`, 6 Trung tâm, các Phòng, 3 Nhóm), một CEO, mỗi nhân viên một dòng "Tuyển mới" trong quá trình công tác. Test tạo phòng ban, nhân viên dùng mã riêng để không trùng seed.

## 5. Cách chạy

```bash
cd backend
npm test -- organization
npm run test:e2e
```

## 6. Kiểm thử phi chức năng

- NFR-1.3: tìm đồng nghiệp p95 < 1 s với 2.000 nhân viên, trong load test tuần 11.
- NFR-1.6: mọi danh sách tối đa 100 dòng (AC-2.1.4).
- NFR-5.21: giới hạn 20 request tìm kiếm danh bạ (`GET /employees`) mỗi phút cho mỗi người dùng, vượt ngưỡng trả 429 (chống quét danh bạ T-11).

## 7. Ca còn thiếu (TV4)

- Cơ bản & phân quyền: AC-2.1.1 (theo mã, email), AC-2.1.2, AC-2.1.3, AC-2.1.4, AC-2.4.3; AC-2.4.6, AC-2.4.7 (đối chiếu sau PR #84).
- Dữ liệu test đã theo seed mới (gốc `HQ`, loại đơn vị ADR-14). Job điều chuyển chạy 5 phút một lần, nên điều chuyển hiệu lực ngày D được áp dụng trong khoảng 00:00–00:05 ngày D (giờ Việt Nam), trước mốc 00:15 của AC-2.7.2.
- Các ca biên nghiệp vụ trước đây còn thiếu (nghỉ việc gỡ vai trò, ngừng đơn vị có trưởng kiêm nhiệm, bảo vệ chức danh `CEO`)
  đã có test e2e ở `feat/department-admin-ui`.
- Ngoại lệ bổ sung [spec mục 6.1](spec.md#61-ngoại-lệ-bổ-sung-rà-24112026) (E14 → E22): bổ sung ca E18 cho ngày hiệu lực đúng mốc một năm (được nhận) và ngày sau mốc (400); bổ sung ca E22 cho người có điều chuyển tương lai sang đơn vị khác (gán trưởng trả 409), rồi hủy/đổi điều chuyển và thử lại. **E18, E22 đã có e2e** (chạy xanh 25/11); unit test `transferHorizon` có ca 29/2.
