# Tuần 10 – TV4 (Duy): smoke test staging, kiểm thử chức năng mới

Vai trò: viết ca kiểm thử từ quy tắc nghiệp vụ, chạy thật trên hệ thống và ghi đúng kết quả quan sát được.

## Nguyên tắc ghi kết quả kiểm thử (bắt buộc)

Tuần 9, kết quả của #47 và #54 phải chạy lại vì biên bản không tái hiện được. Tuần này:

- Chỉ ghi Đạt/Không đạt cho bước **đã chạy thật** ở lần ghi đó, kèm ngày chạy và commit (`git log -1 --oneline`).
- Cột "Kết quả thực tế" ghi điều quan sát được: mã HTTP, thông báo trên màn hình, số liệu trước/sau. Không ghi "khớp thiết kế".
- Ca có body thì ghi body đã gửi. Tên trường lấy từ Swagger.
- Ghi rõ ca chạy trên giao diện và ca gọi API.
- Ca chưa chạy đưa vào "Phạm vi chưa kiểm" kèm lý do, cột kết quả để trống.
- Mỗi lỗi một issue: môi trường + commit, bước tái hiện, mong đợi, thực tế, ảnh hoặc request/response, traceId.

Mẫu: mục 2 của [`docs/business/test-report-tuan-08.md`](../../business/test-report-tuan-08.md).

## Hạn chót

| Hạn | Việc |
|---|---|
| Sau khi TV3 báo staging lên 1 ngày | Mở PR `docs/test-report-staging` |
| **T5 (12/11), 21:00** | Mở PR `docs/test-cases-week10` (cần quy tắc của TV2, merge T4) |
| T6 (13/11) | Sửa theo góp ý, được merge |
| Trong 24 giờ kể từ khi PR mở | Review `feat/hr-employee-form`, `feat/document-search` của TV1: kết quả có khớp ca kiểm thử không |
| **CN (15/11), 12:00** | Mở PR `docs/test-report-week10` |
| **T2 (16/11), 9:00** | Điền mục "Việc đã làm" |

## Chuẩn bị môi trường

Như tuần 9 (`docker compose up -d --build`; Web http://localhost:5173, Swagger http://localhost:3000/api/docs, Mailpit
http://localhost:8025). Tài khoản `employee`, `manager`, `hr`, `admin`, mật khẩu `Passw0rd!`. Muốn dữ liệu sạch:
`docker compose down -v && docker compose up -d --build`.

## Việc cần làm

### 1. `docs/test-report-staging` – smoke test staging (tồn từ tuần 9)

Chỉ làm khi TV3 báo staging đã chạy. File `docs/business/test-report-tuan-10.md` mục 1.

1. Đăng nhập 4 tài khoản, mở 5 màn hình tuần 7.
2. Luồng ngắn: `employee` tạo đơn → `manager` duyệt → `hr` hoàn tất; ghi số dư trước/sau.
3. Ghi URL, thời điểm, commit đã deploy, kết quả từng bước. Staging chưa lên thì ghi "chưa kiểm".

### 2. `docs/test-cases-week10` – ca kiểm thử mới

File `docs/business/test-cases-tuan-10.md`, cùng định dạng `leave-test-cases.md`.

- Kho tài liệu theo `document-rules.md` (`DOC-01…`): tải lên, loại file sai, xem đúng và sai phạm vi, phiên bản.
- Tìm kiếm (`SRCH-01…`): tìm thấy trong phạm vi, **không thấy tài liệu ngoài phạm vi**.
- Hồ sơ (`EMP-01…`): HR tạo, sửa; `employee`, `admin` bị chặn; thiếu quản lý; vòng lặp quản lý.
- Audit (`AUD-01…`): lọc, vai trò khác bị chặn.
- CEO: HR duyệt đơn CEO, HR không duyệt đơn người khác.
- BR-06, BR-12 viết khi TV1 xác nhận làm trong tuần.

### 3. `docs/test-report-week10` – chạy ca kiểm thử

Chạy trên `dev` khi code đã merge, ghi vào `test-report-tuan-10.md` mục 2. Tính năng chưa merge thì đưa vào "Phạm vi chưa kiểm".

## Cách làm trên git

```bash
git checkout dev && git pull
git checkout -b docs/test-cases-week10
# viết file, commit, rồi:
git push -u origin docs/test-cases-week10
```

Mỗi việc một nhánh mới tách từ `dev`. Mở PR vào `dev`, điền mô tả. Không sửa `leave-test-cases.md` và mục đã chốt của biên bản cũ.

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (16/11), 9:00._
