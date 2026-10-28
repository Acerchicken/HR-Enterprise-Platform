# Danh mục loại phép và ngày nghỉ lễ năm 2026

Tài liệu này quy định các loại nghỉ phép dùng trong hệ thống Enterprise HR Platform và danh sách ngày nghỉ lễ năm 2026.
Căn cứ chính: Bộ luật Lao động 2019 (Điều 111–115) và Luật Bảo hiểm xã hội 2024 (hiệu lực từ 1/7/2025).

## 1. Danh mục loại phép

Cột "Mã" dùng cho `leave.leave_type.code` (tối đa 20 ký tự) trong API. Seed hiện có `ANNUAL`, `SICK`, `MARRIAGE`, `UNPAID`;
các mã còn lại TV1 bổ sung khi đưa vào hệ thống.

| Mã | Tên | Số ngày tối đa | Có lương hay không | Giấy tờ cần nộp |
|---|---|---|---|---|
| `ANNUAL` | Nghỉ phép năm | 12 ngày/năm khi làm đủ 12 tháng; cộng 1 ngày cho mỗi 5 năm thâm niên (Điều 113, 114 BLLĐ) | Có, công ty trả 100% lương | Không cần |
| `SICK` | Nghỉ ốm | 30 ngày/năm nếu đóng BHXH dưới 15 năm; 40 ngày nếu từ 15 đến dưới 30 năm; 60 ngày nếu từ 30 năm | Không do công ty trả; hưởng chế độ ốm đau từ BHXH | Giấy chứng nhận nghỉ việc hưởng BHXH hoặc giấy ra viện |
| `MARRIAGE` | Nghỉ cưới (bản thân kết hôn) | 3 ngày/lần (Điều 115 BLLĐ) | Có, công ty trả 100% lương | Giấy chứng nhận đăng ký kết hôn |
| `CHILD_MARRIAGE` | Con kết hôn | 1 ngày/lần (Điều 115 BLLĐ) | Có, công ty trả 100% lương | Giấy chứng nhận đăng ký kết hôn của con |
| `BEREAVEMENT` | Nghỉ tang (cha, mẹ đẻ/nuôi của mình hoặc của vợ/chồng; vợ/chồng; con chết) | 3 ngày/lần (Điều 115 BLLĐ) | Có, công ty trả 100% lương | Giấy chứng tử hoặc giấy báo tử |
| `MATERNITY` | Thai sản (lao động nữ sinh con) | 6 tháng/lần sinh; sinh đôi trở lên thêm 1 tháng mỗi con từ con thứ hai | Không do công ty trả; BHXH trả chế độ thai sản | Giấy chứng sinh hoặc giấy khai sinh của con |
| `PATERNITY` | Lao động nam nghỉ khi vợ sinh con | 5–14 ngày làm việc tùy trường hợp (sinh thường, sinh mổ, sinh đôi…) | Không do công ty trả; BHXH trả chế độ thai sản | Giấy chứng sinh hoặc giấy khai sinh của con |
| `UNPAID` | Nghỉ không lương | 30 ngày/năm (theo seed hiện tại); vượt mức phải thỏa thuận riêng với công ty | Không | Không cần; phải được quản lý trực tiếp duyệt theo luồng nghỉ phép |

Ghi chú:
- Chỉ `ANNUAL` và `SICK` có bảng số dư (`leave.leave_balance`) trong seed. Các loại nghỉ theo sự kiện (`MARRIAGE`,
  `CHILD_MARRIAGE`, `BEREAVEMENT`, `MATERNITY`, `PATERNITY`) tính theo từng lần, không trừ vào phép năm.
- Giấy tờ nộp cho HR khi HR hoàn tất đơn (bước `COMPLETED`). MVP chưa có chức năng đính kèm file.

## 2. Ngày nghỉ lễ năm 2026

Hệ thống không trừ phép những ngày nghỉ lễ trong danh sách dưới đây (BR-03).

| Ngày | Thứ | Dịp | Ghi chú |
|---|---|---|---|
| 01/01/2026 | Năm | Tết Dương lịch | |
| 16/02/2026 – 20/02/2026 | Hai – Sáu | Tết Nguyên đán Bính Ngọ (5 ngày) | 1 ngày cuối năm Ất Tỵ và 4 ngày đầu năm Bính Ngọ, theo lịch nghỉ của khu vực công |
| 26/04/2026 | Chủ nhật | Giỗ Tổ Hùng Vương (10/3 âm lịch) | Trùng ngày nghỉ hằng tuần |
| 27/04/2026 | Hai | Nghỉ bù Giỗ Tổ Hùng Vương | Ngày lễ trùng ngày nghỉ hằng tuần thì nghỉ bù vào ngày làm việc kế tiếp (Điều 111 BLLĐ) |
| 30/04/2026 | Năm | Ngày Chiến thắng | |
| 01/05/2026 | Sáu | Quốc tế Lao động | |
| 01/09/2026 | Ba | Quốc khánh (ngày liền kề) | Doanh nghiệp được chọn 1/9 hoặc 3/9; công ty chọn 1/9 giống khu vực công |
| 02/09/2026 | Tư | Quốc khánh | |
| 24/11/2026 | Ba | Ngày Văn hóa Việt Nam | Ngày nghỉ hưởng nguyên lương mới, áp dụng từ 1/7/2026 |

Các ngày nghỉ lễ rơi vào ngày làm việc (dùng để nạp vào hệ thống):
`2026-01-01`, `2026-02-16`, `2026-02-17`, `2026-02-18`, `2026-02-19`, `2026-02-20`, `2026-04-27`, `2026-04-30`, `2026-05-01`,
`2026-09-01`, `2026-09-02`, `2026-11-24`.

Ngày hoán đổi của khu vực công (nghỉ 02/01/2026 làm bù 10/01; nghỉ 31/08/2026 làm bù 22/08) **không** đưa vào danh sách,
vì doanh nghiệp tự quyết định có áp dụng hay không. Nếu công ty áp dụng, HR bổ sung vào danh sách.

### Nguồn

- Bộ luật Lao động 2019, Điều 111 (nghỉ bù khi ngày lễ trùng ngày nghỉ hằng tuần) và Điều 112 (các ngày nghỉ lễ, tết).
- Thông báo số 9441/TB-BNV ngày 16/10/2025 của Bộ Nội vụ về lịch nghỉ Tết Âm lịch và nghỉ lễ Quốc khánh năm 2026:
  [VOV](https://vov.vn/xa-hoi/chinh-thuc-lich-nghi-tet-nguyen-dan-va-quoc-khanh-nam-2026-post1238570.vov),
  [Cổng thông tin Hà Tĩnh](https://hatinh.gov.vn/vi/bai-viet/thong-bao-chi-tiet-lich-nghi-tet-nguyen-dan-nghi-quoc-khanh-nam-2026).
- Ngày Văn hóa Việt Nam 24/11: nghị quyết của Quốc hội về phát triển văn hóa Việt Nam, hiệu lực từ 1/7/2026
  ([Tuổi Trẻ](https://tuoitre.vn/cac-ngay-nghi-le-con-lai-trong-nam-2026-20260504093846373.htm)). Một số báo dẫn số hiệu
  28/2026/QH16; cần đối chiếu văn bản gốc trên Cổng thông tin Chính phủ.
- Tết Dương lịch 2026: [Báo Quốc tế](https://baoquocte.vn/chot-nghi-tet-duong-lich-2026-bon-ngay-339253.html) (khu vực công nghỉ
  4 ngày do hoán đổi; theo luật chỉ ngày 01/01 là ngày lễ).
