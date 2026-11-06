# Tuần 9 – TV4 (Duy): kiểm thử chức năng và kiểm thử phân quyền

Vai trò: biến business rule và ma trận phân quyền thành ca kiểm thử, **chạy thật** trên hệ thống và ghi lại đúng những gì quan
sát được, mở issue cho từng lỗi.

## Nguyên tắc ghi kết quả kiểm thử (bắt buộc)

Tuần 8, PR #20 ghi PASSED/FAILED cho màn hình nghỉ phép khi màn hình đó chưa có trên `dev`, và issue #18, #19 không tái hiện
được. Từ tuần này:

- Chỉ ghi Đạt/Không đạt cho bước **đã chạy thật**. Mỗi biên bản ghi ngày chạy, commit của `dev` đã chạy (`git log -1 --oneline`),
  tài khoản đã dùng.
- Mỗi dòng có: mã ca, tài khoản, bước đã làm, kết quả mong đợi, **kết quả thực tế quan sát được** (thông báo trên màn hình,
  mã HTTP, số dư trước/sau…), Đạt/Không đạt.
- Ca nào chưa làm được (thiếu màn hình, thiếu dữ liệu, lỗi môi trường) thì ghi vào mục "Phạm vi chưa kiểm" kèm lý do.
- Mỗi issue lỗi phải có: môi trường + commit, các bước tái hiện, kết quả mong đợi, kết quả thực tế, ảnh chụp màn hình hoặc
  request/response, traceId nếu có. Người khác làm theo các bước phải thấy lại được lỗi.

Mẫu: mục 1 của [`docs/business/test-report-tuan-08.md`](../../business/test-report-tuan-08.md).

## Hạn chót

| Hạn | Việc |
|---|---|
| **T3 (3/11), 21:00** | Gửi link nhánh `docs/test-report-leave` (kiểm thử màn hình nghỉ phép) |
| T4 (4/11) | Sửa theo góp ý, mở PR, được merge |
| T5 (5/11) | Đọc ma trận phân quyền của TV2 (sau khi được merge), góp ý nếu thấy dòng nào không kiểm thử được |
| **T6 (6/11), 21:00** | Gửi link nhánh `docs/security-test-cases` (ca kiểm thử phân quyền + kết quả chạy trên local) |
| T7 (7/11) | Sửa theo góp ý, mở PR, được merge |
| **CN (8/11), 21:00** | Gửi link nhánh `docs/test-report-staging` (smoke test staging), nếu staging đã lên lúc 12:00 |
| Trong 24 giờ kể từ khi nhận link | Review nhánh `test/access-control-e2e` của TV1 và `docs/access-control-matrix`, `docs/leave-rules-br06` của TV2 |
| **T2 (9/11), 9:00** | Điền mục "Việc đã làm" ở cuối file này |

## Chuẩn bị môi trường

```bash
git checkout dev && git pull
docker compose up -d --build        # chờ 2–3 phút
docker compose logs -f seed         # chờ dòng "Seed xong" (hoặc "Đã có 2000 nhân viên, bỏ qua")
```

- Web: http://localhost:5173 · Swagger: http://localhost:3000/api/docs · Mailpit (xem email): http://localhost:8025
- Tài khoản: `employee`, `manager` (quản lý trực tiếp của `employee`), `hr`, `admin`, mật khẩu `Passw0rd!`.
- Gọi API trực tiếp (cho ca kiểm thử không làm được trên giao diện, vd gửi lại cùng `Idempotency-Key`, sai `version`): lấy token
  theo hướng dẫn mục "Gọi API bằng curl / Postman" trong `README.md` ở thư mục gốc, rồi bấm **Authorize** trên Swagger và dán token.
  Ghi rõ trong biên bản ca nào kiểm qua giao diện, ca nào kiểm qua API.
- Muốn làm lại từ dữ liệu sạch: `docker compose down -v && docker compose up -d --build`.

## Việc cần làm

### 1. `docs/test-report-leave` – kiểm thử màn hình nghỉ phép (việc tồn tuần 8)

Màn hình nghỉ phép đã có trên `dev` từ PR #25: menu **Nghỉ phép** (tạo đơn, đơn của tôi), **Duyệt đơn** (chỉ `manager`),
**HR hoàn tất** (chỉ `hr`), trang chi tiết đơn có lịch sử.

1. Chạy lần lượt TC-01 → TC-22 trong [`docs/business/leave-test-cases.md`](../../business/leave-test-cases.md).
   **Không sửa file ca kiểm thử**; thấy ca nào sai thì ghi góp ý trong biên bản.
2. Với ca thay đổi số dư (TC-01, TC-15, TC-17, TC-20): ghi bảng "Số dư phép" trên trang **Hồ sơ của tôi** trước và sau.
3. Với ca có email (tạo, duyệt, từ chối, hủy, hoàn tất): mở Mailpit, ghi người nhận và tiêu đề email.
4. Điền **mục 2 "Màn hình nghỉ phép"** trong `docs/business/test-report-tuan-08.md`, giữ nguyên mục 1. Định dạng bảng như
   mục 1.1: `# | Mã TC | Tài khoản | Bước | Kết quả mong đợi | Kết quả thực tế | KQ`.
5. Mở issue cho từng lỗi tìm thấy (theo nguyên tắc ở trên), ghi số issue vào biên bản.
6. Issue #18 và #19 (mở ngày 1/11): chạy lại đúng các bước trong issue trên `dev` hiện tại. Tái hiện được thì bổ sung
   bằng chứng vào issue; không tái hiện được thì comment kết quả chạy lại và đóng issue.
7. Hai lỗi dữ liệu L-01 ("Phòng test" do e2e để lại) và L-02 (ngày sinh của `admin` sau ngày vào làm) ở mục 1.3 của biên bản:
   mở issue riêng cho từng lỗi với đúng nội dung đó, ghi số issue vào cột "Ghi chú".

Xong khi: đủ 22 ca có kết quả thực tế hoặc nằm trong "Phạm vi chưa kiểm" có lý do; mọi lỗi có issue.

### 2. `docs/security-test-cases` – ca kiểm thử phân quyền

Dựa trên `docs/security/access-control-matrix.md` của TV2 (merge T5 5/11).

1. Viết `docs/business/security-test-cases.md`: mỗi dòng của ma trận ít nhất **một ca được phép** và **một ca bị chặn**.
   Mỗi ca: mã `SEC-01…`, dòng ma trận liên quan, tài khoản, request (method + đường dẫn + body), kết quả mong đợi (mã HTTP và dữ
   liệu trả về). Ví dụ:

   | Mã | Ma trận | Tài khoản | Request | Mong đợi |
   |---|---|---|---|---|
   | SEC-01 | Hồ sơ – xem trường nhạy cảm | `hr` | `GET /employees/{id của employee}?include=sensitive` | 200, có `sensitive.nationalId` |
   | SEC-02 | Hồ sơ – xem trường nhạy cảm | `admin` | như trên | 403 |

2. Chạy từng ca trên local qua Swagger hoặc curl, ghi kết quả vào **`docs/business/test-report-tuan-09.md`** mục 1 (cùng
   định dạng biên bản tuần 8: ngày, commit, môi trường, bảng kết quả thực tế).
3. Ca nào kết quả khác ma trận: mở issue, gắn TV1 và TV2.

Xong khi: mọi dòng ma trận có ca kiểm thử và đã chạy, kết quả khác ma trận đều có issue.

### 3. `docs/test-report-staging` – smoke test staging

Chỉ làm khi TV3 báo staging đã chạy (dự kiến CN 8/11, 12:00). TV3 sẽ gửi URL và tài khoản staging.

1. Đăng nhập 4 tài khoản trên staging, mở 5 màn hình tuần 7.
2. Chạy luồng ngắn: `employee` tạo đơn → `manager` duyệt → `hr` hoàn tất.
3. Ghi vào mục 2 "Staging" của `docs/business/test-report-tuan-09.md`: URL, thời điểm, kết quả từng bước.

Staging chưa lên đúng hạn thì ghi "chưa kiểm, staging chưa sẵn sàng" và không làm việc này.

## Cách làm trên git (quy trình mới)

```bash
git checkout dev && git pull
git checkout -b docs/test-report-leave
# viết biên bản, rồi:
git add docs/business/test-report-tuan-08.md
git commit -m "docs(testing): add leave screens test results"
git push -u origin docs/test-report-leave
```

Sau đó **chưa mở PR**: gửi link `https://github.com/Acerchicken/HR-Enterprise-Platform/compare/dev...docs/test-report-leave`
vào nhóm chat. Đợi góp ý ở mục "Góp ý review" bên dưới, sửa trên cùng nhánh (commit thêm, không tạo nhánh mới), hết góp ý
"cần sửa" thì `git pull origin dev`, rồi mới mở PR vào `dev`.

Mỗi việc một nhánh mới tách từ `dev`. Không dùng lại nhánh `docs/leave-test-cases` cũ.

## Góp ý review

_TV1 ghi góp ý vào đây trước khi bạn mở PR. Mỗi dòng: ngày, nhánh, người góp ý, nội dung ("cần sửa" hoặc "nit:"), trạng thái._

| Ngày | Nhánh | Người góp ý | Góp ý | Trạng thái |
|---|---|---|---|---|
| 5/11 | `docs/test-report-leave` | TV1 | **Trễ hạn:** hạn gửi link là 3/11 21:00, đến 5/11 chưa có nhánh mới; nhánh `docs/test-report-leave` cũ vẫn là bản 1/11 (PR #20 đã đóng). Tách nhánh mới từ `dev` hoặc `git pull origin dev` rồi làm lại theo mục 1 của file này; báo TV1 hạn mới có thể làm được | Chưa làm |
| 5/11 | issue #18, #19 | TV1 | Chưa chạy lại và cập nhật theo mục 1, bước 6 | Chưa làm |
| 5/11 | L-01, L-02 | TV1 | Chưa mở issue riêng cho 2 lỗi dữ liệu theo mục 1, bước 7 | Chưa làm |

## Việc đã làm

_Điền T2 (9/11), 9:00._
