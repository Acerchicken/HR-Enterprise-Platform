# Danh mục loại phép và ngày nghỉ lễ năm 2026

> Phụ lục của [BRD](BRD.md): danh mục loại phép và ngày lễ. Bộ tài liệu: [`docs/README.md`](../README.md).

Tài liệu này quy định các loại nghỉ phép dùng trong hệ thống HRHelper và danh sách ngày nghỉ lễ năm 2026.
Căn cứ chính: Bộ luật Lao động 2019 (Điều 111–115) và Luật Bảo hiểm xã hội 2024 (hiệu lực từ 1/7/2025).

## 1. Danh mục loại phép

Cột "Mã" dùng cho `leave.leave_type.code` (tối đa 20 ký tự) trong API. Seed hiện có `ANNUAL`, `SICK`, `MARRIAGE`, `UNPAID`;
các mã còn lại TV1 bổ sung khi đưa vào hệ thống.

| Mã | Tên | Số ngày tối đa | Có lương hay không | Giấy tờ cần nộp | Cần HR duyệt thêm (BR-16) |
|---|---|---|---|---|---|
| `ANNUAL` | Nghỉ phép năm | Mức chuẩn MVP 12 ngày/năm ở điều kiện lao động bình thường; chưa đủ 12 tháng tính theo tỉ lệ số tháng làm việc thực tế trong năm; cộng 1 ngày cho mỗi đủ 5 năm làm việc cho cùng người sử dụng lao động. Công việc/điều kiện thuộc diện 14 hoặc 16 ngày phải dùng mức tương ứng sau khi HR cấu hình | Có, công ty trả 100% lương | Không cần | Không |
| `SICK` | Nghỉ ốm | Điều kiện bình thường: 30 ngày/năm nếu đóng BHXH dưới 15 năm, 40 ngày nếu từ đủ 15 đến dưới 30 năm, 60 ngày nếu từ đủ 30 năm. Nghề/điều kiện thuộc nhóm nặng nhọc, độc hại, nguy hiểm hoặc vùng đặc biệt khó khăn: lần lượt 40/50/70 ngày | Không do công ty trả; hưởng chế độ ốm đau từ BHXH | Giấy chứng nhận nghỉ việc hưởng BHXH hoặc giấy ra viện | Không |
| `MARRIAGE` | Nghỉ cưới (bản thân kết hôn) | 3 ngày/lần (Điều 115 BLLĐ) | Có, công ty trả 100% lương | Giấy chứng nhận đăng ký kết hôn | Không |
| `CHILD_MARRIAGE` | Con kết hôn | 1 ngày/lần (Điều 115 BLLĐ) | Có, công ty trả 100% lương | Giấy chứng nhận đăng ký kết hôn của con | Không |
| `BEREAVEMENT` | Nghỉ tang (cha, mẹ đẻ/nuôi của mình hoặc của vợ/chồng; vợ/chồng; con chết) | 3 ngày/lần (Điều 115 BLLĐ) | Có, công ty trả 100% lương | Giấy chứng tử hoặc giấy báo tử | Không |
| `MATERNITY` | Thai sản (lao động nữ sinh con) | 6 tháng/lần sinh; sinh đôi trở lên thêm 1 tháng mỗi con từ con thứ hai | Không do công ty trả; BHXH trả chế độ thai sản | Giấy chứng sinh hoặc giấy khai sinh của con | **Luôn** |
| `PATERNITY` | Lao động nam nghỉ khi vợ sinh con | 5–14 ngày làm việc tùy trường hợp (sinh thường, sinh mổ, sinh đôi…) | Không do công ty trả; BHXH trả chế độ thai sản | Giấy chứng sinh hoặc giấy khai sinh của con | Không |
| `UNPAID` | Nghỉ không lương | 30 ngày/năm (theo seed hiện tại); vượt mức phải thỏa thuận riêng với công ty | Không | Không cần; phải được quản lý trực tiếp duyệt theo luồng nghỉ phép | **Khi trên 3 ngày làm việc** |

Cột "Cần HR duyệt thêm": đơn của các loại này, sau khi quản lý duyệt, sang HR duyệt lần hai mới thành `APPROVED` (BR-16).
Lý do chọn (soạn 14/11/2026 thay phần chốt của TV2, TV1 và TV2 rà lại):

| Loại | Chọn | Lý do |
|---|---|---|
| `ANNUAL` | Không | Nghỉ thường xuyên, quản lý nắm lịch nhóm; số dư đã được hệ thống chặn (BR-01). HR duyệt mọi đơn thì thành nút cổ chai, khó đạt MT-2 |
| `SICK` | Không | Thường đột xuất, cần quyết định ngay. Giấy tờ BHXH HR kiểm khi hoàn tất (BR-10) |
| `MARRIAGE`, `CHILD_MARRIAGE`, `BEREAVEMENT` | Không | Ngắn (1–3 ngày), luật định sẵn số ngày; giấy tờ kiểm khi hoàn tất |
| `PATERNITY` | Không | Ngắn (5–14 ngày), BHXH trả; giấy tờ kiểm khi hoàn tất |
| `MATERNITY` | Luôn | Nghỉ 6 tháng: HR phải lập hồ sơ hưởng thai sản BHXH, báo giảm lao động, tính ngày quay lại và sắp xếp người thay. Quản lý chỉ nắm được phần công việc |
| `UNPAID` | Khi trên 3 ngày làm việc | Bị trừ lương; nghỉ không lương từ 14 ngày làm việc trở lên trong tháng thì tháng đó không đóng BHXH, HR phải biết trước để báo giảm. Dưới 3 ngày là việc riêng ngắn, để quản lý quyết |

Ngưỡng 3 ngày là lựa chọn của công ty, không phải quy định của luật; đổi ở cấu hình loại phép.

Ghi chú:
- Cách tính số dư phép năm và tháng làm việc thực tế theo BR-01: `(mức ngày phép theo điều kiện lao động + ngày tăng thêm theo thâm niên) / 12 × số tháng làm việc thực tế trong năm`. Nếu làm chưa đủ tháng, tháng được tính khi tổng ngày làm việc và ngày nghỉ hưởng lương đạt ít nhất 50% ngày làm việc bình thường của tháng; dưới ngưỡng không tính. Mức 12 ngày là mặc định MVP cho điều kiện bình thường, không thay thế việc xác định nhóm công việc có mức 14 hoặc 16 ngày. Số dư lưu đến 2 chữ số thập phân, không làm tròn giảm; đơn nghỉ vẫn theo bước 0,5 ngày.
- Số ngày `SICK` trong bảng là giới hạn quyền lợi BHXH, phụ thuộc thời gian đóng BHXH và nhóm điều kiện lao động, không phải hạn mức công ty tự suy từ `hireDate`. Vì MVP chưa có quá trình đóng BHXH đã xác minh/nhóm công việc, HR phải nhập hạn mức theo hồ sơ phù hợp (BR-18); không tự cấp dựa trên số năm làm ở doanh nghiệp.
- Chỉ `ANNUAL` và `SICK` có bảng số dư (`leave.leave_balance`) trong seed. Các loại nghỉ theo sự kiện (`MARRIAGE`,
  `CHILD_MARRIAGE`, `BEREAVEMENT`, `MATERNITY`, `PATERNITY`) tính theo từng lần, không trừ vào phép năm.
- Các loại nghỉ theo sự kiện được cấp theo sự kiện hợp lệ và giới hạn trong bảng loại phép; không được quy đổi thành phép năm hay cộng vào số dư phép năm. Nếu một lần nghỉ vượt quá mức hưởng theo sự kiện, đơn vượt mức bị từ chối; MVP không hỗ trợ tách cùng khoảng ngày giữa loại phép sự kiện và loại phép khác. Nhân viên có thể gửi đơn loại phép khác cho những ngày riêng biệt, nếu đủ điều kiện số dư và không trùng lịch (BR-01, BR-02).
- Giấy tờ nộp cho HR khi HR hoàn tất đơn (bước `COMPLETED`). MVP chưa có chức năng đính kèm file.
- Đơn kéo qua năm mới (ví dụ 29/12/2026 – 4/1/2027) tính ngày làm việc của từng năm theo lịch lễ năm đó và trừ vào số dư
  của năm đó (BR-01). Cần bổ sung lịch nghỉ lễ 2027 ở mục 2 khi Chính phủ công bố lịch nghỉ Tết Đinh Mùi.

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
- Bộ luật Lao động 2019, Điều 113–115 ([văn bản Chính phủ](https://vanban.chinhphu.vn/?docid=198540&pageid=27160)); Nghị định 145/2020/NĐ-CP, Điều 65–66 ([văn bản Chính phủ](https://vanban.chinhphu.vn/default.aspx?docid=201967&pageid=27160); hướng dẫn của Bộ Nội vụ về phép năm khi chưa đủ 12 tháng [Chính sách Online](https://chinhsachonline.chinhphu.vn/lam-viec-chua-du-12-thang-tinh-ngay-nghi-phep-the-nao-84866.htm)).
- Luật Bảo hiểm xã hội 2024, Điều 43 ([văn bản Chính phủ](https://vanban.chinhphu.vn/?classid=1&docid=211199&pageid=27160&typegroupid=3)); hướng dẫn thời hạn nghỉ ốm theo thời gian đóng BHXH và điều kiện lao động ([Chính sách Online](https://chinhsachonline.chinhphu.vn/che-do-om-dau-dai-ngay-tinh-theo-ngay-lam-viec-89242.htm)).
- Thông báo số 9441/TB-BNV ngày 16/10/2025 của Bộ Nội vụ về lịch nghỉ Tết Âm lịch và nghỉ lễ Quốc khánh năm 2026:
  [VOV](https://vov.vn/xa-hoi/chinh-thuc-lich-nghi-tet-nguyen-dan-va-quoc-khanh-nam-2026-post1238570.vov),
  [Cổng thông tin Hà Tĩnh](https://hatinh.gov.vn/vi/bai-viet/thong-bao-chi-tiet-lich-nghi-tet-nguyen-dan-nghi-quoc-khanh-nam-2026).
- Ngày Văn hóa Việt Nam 24/11: nghị quyết của Quốc hội về phát triển văn hóa Việt Nam, hiệu lực từ 1/7/2026
  ([Tuổi Trẻ](https://tuoitre.vn/cac-ngay-nghi-le-con-lai-trong-nam-2026-20260504093846373.htm)). Một số báo dẫn số hiệu
  28/2026/QH16; cần đối chiếu văn bản gốc trên Cổng thông tin Chính phủ.
- Tết Dương lịch 2026: [Báo Quốc tế](https://baoquocte.vn/chot-nghi-tet-duong-lich-2026-bon-ngay-339253.html) (khu vực công nghỉ
  4 ngày do hoán đổi; theo luật chỉ ngày 01/01 là ngày lễ).
