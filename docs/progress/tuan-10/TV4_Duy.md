# Tuần 10 – TV4 (Duy): smoke test staging, kiểm thử chức năng mới

Vai trò: viết ca kiểm thử từ quy tắc nghiệp vụ, chạy thật trên hệ thống và ghi đúng kết quả quan sát được.

## Cập nhật 14/11

Nhóm chuyển sang làm xong từng chức năng một, bắt đầu UC1 ([kế hoạch tổng mục 7](../ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13)). TV4 viết ca kiểm thử trước một
bước và chạy kiểm thử chức năng vừa code xong.

TV1 đã viết `test.md` của UC1 → UC7 (PR #76), là phần thuộc vai trò kiểm thử. Người viết là TV1. Việc của TV4 là đọc, đối chiếu
bảng phủ AC với test đang có và góp ý bằng review trên PR; ca còn thiếu thì TV4 tự viết ở nhánh của mình.

| Hạn | Việc |
|---|---|
| **T2 (16/11), 21:00** | Review `test.md` của UC1 trên #76: bảng phủ AC đúng chưa, ca nào thiếu |
| CN (15/11), 12:00 | Vẫn giữ: mở PR `docs/test-report-week10` (chức năng chưa merge đưa vào "Phạm vi chưa kiểm") |
| **T3 (17/11), 21:00** | Mở PR `docs/test-cases-uc1` (bước 1) |
| Trước hạn mở PR ca kiểm thử của mỗi bước | Review `test.md` của UC tương ứng trên #76 |

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

### 1. Smoke test staging: chuyển sang tuần 12

Staging chỉ chạy trên AWS ở tuần 12–13 (quyết định ngày 10/11), nên việc này làm ở tuần 12.

### 2. `docs/test-cases-week10` – ca kiểm thử mới

File `docs/business/test-cases-tuan-10.md`, cùng định dạng `leave-test-cases.md`.

- Kho tài liệu theo `document-rules.md` (`DOC-01…`): tải lên, loại file sai, xem đúng và sai phạm vi, phiên bản.
- Tìm kiếm (`SRCH-01…`): tìm thấy trong phạm vi, **không thấy tài liệu ngoài phạm vi**.
- Hồ sơ (`EMP-01…`): HR tạo, sửa; `employee`, `admin` bị chặn; thiếu quản lý; vòng lặp quản lý.
- Audit (`AUD-01…`): lọc, vai trò khác bị chặn.
- CEO: HR duyệt đơn CEO, HR không duyệt đơn người khác.
- BR-06, BR-12 viết khi TV1 xác nhận làm trong tuần.

### 3. `docs/test-report-week10` – chạy ca kiểm thử

Chạy trên `dev` (local) khi code đã merge, ghi vào `docs/business/test-report-tuan-10.md`. Tính năng chưa merge thì đưa vào "Phạm vi chưa kiểm".

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
