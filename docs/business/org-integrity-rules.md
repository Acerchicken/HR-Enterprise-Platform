# Quyết định nghiệp vụ: toàn vẹn tổ chức và hồ sơ nhân viên

**Người rà soát:** TV2 (Thanh)
**Ngày:** 17/11/2026
**Phạm vi đối chiếu:** ADR-14 (#83), thay đổi toàn vẹn hồ sơ và tổ chức (#84), yêu cầu cập nhật hồ sơ (#86). Các PR trên đã merge; nội dung dưới đây chốt nghiệp vụ và ghi rõ phần cần TV1 xử lý ở PR tiếp theo.

## Quyết định

### 1. Chấm dứt nhân viên còn cấp dưới

**Quyết định:** Không chấm dứt nhân viên (`TERMINATED`) khi người đó còn nhân viên cấp dưới đang làm việc (`ACTIVE` hoặc `ON_LEAVE`). HR phải chuyển từng cấp dưới sang một quản lý trực tiếp khác đang làm việc trước, sau đó mới chấm dứt nhân viên quản lý. Quản lý mới phải hợp lệ theo quy tắc một quản lý trực tiếp, không tự quản lý và không tạo vòng lặp. Đơn nghỉ đang chờ của cấp dưới được chuyển sang quản lý mới theo BR-05; không tự duyệt hoặc hủy đơn.

**Đối chiếu code #84:** Đã chặn chuyển sang `TERMINATED` khi còn cấp dưới `ACTIVE`/`ON_LEAVE`, trả lỗi 400 và số lượng cần chuyển. Phần chuyển cấp dưới và đơn nghỉ là thao tác HR trước khi chấm dứt, không tự động gán trong thao tác chấm dứt. Quy tắc này khớp quyết định.

### 2. `headEmployeeId`, trưởng/phó đơn vị và `managerId`

**Quyết định:** `headEmployeeId` biểu thị người đứng đầu một đơn vị; đây không phải nguồn xác định quản lý trực tiếp. `managerId` là quan hệ quản lý trực tiếp duy nhất, dùng cho phạm vi quản lý và người duyệt đơn nghỉ. HR có thể chọn quản lý trực tiếp khác với trưởng đơn vị theo tổ chức thực tế; phó đơn vị không mặc nhiên có quyền duyệt.

| Loại đơn vị | Người đứng đầu | Số phó tối đa |
|---|---|---:|
| Công ty (`COMPANY`) | Tổng Giám đốc (CEO) | 5 |
| Trung tâm (`CENTER`) | Giám đốc trung tâm | 3 |
| Phòng (`DEPARTMENT`) | Trưởng phòng | 3 |
| Nhóm (`TEAM`) | Trưởng nhóm | 0 |

Người đứng đầu, người phụ trách (`acting`) và phó phải là nhân viên đang làm việc, thuộc chính đơn vị hoặc một đơn vị cha của đơn vị đó; cho phép kiêm nhiệm từ cấp cha xuống cấp con. `acting` chỉ đổi cách hiển thị chức danh, không đổi quyền. Quy tắc cha-con của loại đơn vị theo ADR-14. CEO là người duy nhất không có `managerId`; đơn nghỉ của CEO do HR xử lý theo UC4 E8.

**Đối chiếu code/tài liệu:** ADR-14 (#83) mô tả các quy tắc trên nhưng vẫn ghi trạng thái “Đề xuất”; PR #83 nêu phần code loại đơn vị thuộc việc sau. Code #84 mới kiểm tra `headEmployeeId` là nhân viên đang làm việc; chưa enforce loại đơn vị, quan hệ đơn vị cha-con, quy tắc trưởng/phó/kiêm nhiệm và số phó tối đa. `managerId` được kiểm tra theo ngoại lệ CEO, tình trạng quản lý và vòng lặp; đây là trường riêng với `headEmployeeId`.

**Việc TV1 cần làm ở PR mới:** Sau khi nghiệp vụ này được chấp nhận, chuyển ADR-14 sang trạng thái đã chấp nhận và triển khai/kiểm thử các quy tắc loại đơn vị, trưởng/phó, `acting`, kiêm nhiệm và giới hạn số phó. Bổ sung kiểm tra `headEmployeeId` phải thuộc đơn vị đó hoặc đơn vị cha, ngoài điều kiện đang làm việc. Giữ `managerId` là nguồn chuẩn cho quản lý trực tiếp và duyệt đơn.

### 3. Nội dung audit theo nhóm trường

**Quyết định:** Audit trường tổ chức được ghi giá trị cũ và mới để truy vết biến động: `departmentId`, `positionId`, `managerId`, `status`, `hireDate`. Trường cá nhân và nhạy cảm chỉ ghi tên trường, giá trị thay bằng `***`; không ghi giá trị cũ/mới. Lịch sử hiển thị cho người dùng chỉ hiện thao tác, mục và tên trường, không hiện giá trị.

**Đối chiếu code #84:** Quy tắc cho nhóm trường tổ chức và các trường cá nhân/nhạy cảm đã được triển khai. Tuy nhiên, `employeeCode` hiện nằm trong nhóm giữ giá trị audit cùng trường tổ chức, trong khi đây là mã định danh cá nhân chứ không phải dữ liệu tổ chức cần lưu giá trị để dựng lịch sử điều chuyển.

**Việc TV1 cần làm ở PR mới:** Bỏ `employeeCode` khỏi nhóm giữ giá trị audit; với trường này chỉ ghi tên trường và `***`. Giữ nguyên giá trị cũ/mới cho đúng năm trường tổ chức nêu trên. Rà soát cả thao tác tạo mới để không lưu giá trị định danh cá nhân vào audit.

### 4. Thời gian lưu audit

**Quyết định:** Chọn **5 năm kể từ lúc ghi** làm thời hạn lưu audit nội bộ, theo BR-13 và quyết định đã ghi tại BRD mục 15. Đây là mốc chính sách nội bộ, không khẳng định là thời hạn luật định. HR/pháp chế phải xác nhận trước production; nếu quy định bắt buộc hoặc legal hold yêu cầu lâu hơn thì áp dụng thời hạn dài hơn và tạm dừng hủy.

**Đối chiếu tài liệu/code:** NFR-6.3 trong SRS hiện ghi tối thiểu 2 năm và mục câu hỏi chờ chốt cũng ghi 2 năm, mâu thuẫn BR-13. Code audit append-only không cho ứng dụng sửa/xóa nhưng chưa có cơ chế archive hoặc xử lý hết hạn.

**Việc TV1 cần làm ở PR mới:** Đồng bộ NFR-6.3 và câu hỏi/quyết định liên quan trong SRS thành 5 năm; trước production thiết kế quy trình archive bất biến hoặc hủy/khử định danh hết hạn được phê duyệt, có legal hold và không cấp quyền xóa thông thường cho ứng dụng. Chưa được coi là đã có retention chỉ vì bảng audit append-only.

### 5. Nhân viên được gửi yêu cầu cập nhật và hạn HR xử lý

**Quyết định về phạm vi FR-1.9:** Nhân viên chỉ gửi yêu cầu cho hồ sơ của chính mình, gồm:

- Điện thoại, địa chỉ.
- Liên hệ khẩn cấp.
- Thân nhân/người phụ thuộc.
- Chuyên môn, bằng cấp/chứng chỉ.
- Tài khoản ngân hàng.
- Nơi khám chữa bệnh ban đầu.
- Ảnh đại diện và CV.

Yêu cầu chỉ ở trạng thái chờ; dữ liệu hồ sơ không đổi cho tới khi HR duyệt. HR có thể sửa trực tiếp theo quyền được quy định. Nhân viên không dùng luồng này để sửa trường HR quản lý như trạng thái, phòng ban, chức danh, quản lý trực tiếp, lương, hợp đồng hoặc quyết định nhân sự.

**Quyết định về thời hạn:** HR xử lý trong **2 ngày làm việc** kể từ khi nhận yêu cầu. Hệ thống đánh dấu “Quá hạn”, đưa yêu cầu quá hạn lên đầu danh sách; quá hạn không tự duyệt hoặc tự hủy. Lịch ngày làm việc loại trừ cuối tuần và ngày nghỉ theo lịch doanh nghiệp.

**Đối chiếu tài liệu/code #86:** Phạm vi các mục được gửi yêu cầu, duyệt/từ chối và nhãn quá hạn 2 ngày làm việc đã được mô tả trong UC1. Hạn xử lý được nêu tại **AC-1.9.13 của FR-1.9**, không phải FR-1.14. FR-1.14 là giới hạn tần suất và hạn mức chống lạm dụng. Code #86 có hàng đợi ưu tiên yêu cầu quá hạn; đây là nhắc việc/giám sát, không tự xử lý yêu cầu. Cần dùng lịch ngày nghỉ doanh nghiệp nhất quán để tính ngày làm việc.

**Việc TV1 cần làm ở PR mới:** Sửa mọi chỗ ghi hạn HR xử lý là FR-1.14 thành FR-1.9/AC-1.9.13. Xác nhận logic tính 2 ngày làm việc dùng lịch nghỉ doanh nghiệp; giữ hành vi không tự duyệt/hủy. Nếu chưa dùng lịch ngày nghỉ khi tính hạn, bổ sung ở PR mới.

## Tóm tắt phần cần TV1 theo dõi

1. ADR-14 chuyển từ “Đề xuất” sang “Đã chấp nhận” sau khi quyết định được duyệt; triển khai luật trưởng/phó theo loại đơn vị và quan hệ cha-con.
2. Không lưu giá trị `employeeCode` trong audit; chỉ ghi tên trường và giá trị che.
3. Đồng bộ SRS NFR-6.3 thành 5 năm theo BR-13; lập phương án retention trước production.
4. Chuẩn hóa tham chiếu hạn HR xử lý về FR-1.9/AC-1.9.13; xác minh lịch ngày làm việc.

## Tài liệu đối chiếu

- [ADR-14 – Cây đơn vị tổ chức có loại đơn vị](../architecture/adr/ADR-14-org-unit-types.md)
- [UC1 – Requirements](../features/UC1-employee-profile/requirements.md) và [UC1 – Spec](../features/UC1-employee-profile/spec.md)
- [BRD – Quyết định đã chốt, mục 15](BRD.md#15-vấn-đề-còn-mở-và-quyết-định-đã-chốt)
- [SRS – Yêu cầu audit NFR-6.3](../requirements/SRS.md)
- PR [#83](https://github.com/Acerchicken/HR-Enterprise-Platform/pull/83), [#84](https://github.com/Acerchicken/HR-Enterprise-Platform/pull/84), [#86](https://github.com/Acerchicken/HR-Enterprise-Platform/pull/86)
