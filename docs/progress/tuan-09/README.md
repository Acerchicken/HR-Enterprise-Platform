# Tuần 9 (2/11 – 9/11) – P3: Security & DevOps

Mục tiêu tuần:
1. **Bảo mật:** có ma trận phân quyền (RBAC/ABAC) và threat model cho luồng hồ sơ và nghỉ phép; mỗi dòng của ma trận có e2e
   test và ca kiểm thử; production không chạy được nếu thiếu secret.
2. **DevOps:** CI build và quét lỗ hổng image Docker; hạ tầng staging trên AWS dựng bằng Terraform; deploy staging lần đầu
   bằng pipeline, không thao tác tay trên console.
3. **Việc tồn từ tuần 8:** chốt ADR-12, kiểm thử màn hình nghỉ phép theo ca kiểm thử, chốt BR-06.

Phân vai theo ADR-11: TV1 Duong code, TV2 Thanh nghiệp vụ + bảo mật nghiệp vụ, TV3 Bảo cloud, IaC, CI/CD, TV4 Duy kiểm thử.

> Đã chốt ngày 9/11/2026. Bản chốt trên `main` có tag [`week-09`](https://github.com/Acerchicken/HR-Enterprise-Platform/releases/tag/week-09).

## Quy trình tuần này (mới)

Áp dụng [`CONVENTIONS.md` mục 6](../../CONVENTIONS.md#quy-trình-cho-một-việc):

1. Tách nhánh từ `dev`, làm xong thì push nhánh và **mở PR** vào `dev` (chưa xong mà muốn xem sớm thì mở Draft PR).
2. Người review góp ý **trên PR** ("Request changes" nếu có góp ý "cần sửa").
3. Người làm sửa trên cùng nhánh, `git push` là PR tự cập nhật, rồi bấm "Re-request review". Lặp tới khi được approve,
   Duong squash merge.
4. Mỗi việc một PR. Không đóng PR chưa đạt để mở PR mới; chỉ đóng khi việc bị hủy, làm sai hướng hoàn toàn hoặc PR trùng.

> Đổi ngày 7/11: từ 2/11 tới 7/11 nhóm thử review trên nhánh và ghi góp ý vào file cá nhân trước khi mở PR. Từ 7/11 quay lại
> review trên PR như trên. Góp ý cũ trong mục "Góp ý review" của file cá nhân giữ làm lịch sử.

Trong bảng dưới, **"Gửi review"** là hạn mở PR, **"Merge"** là hạn PR được approve và merge (có 1 ngày để sửa theo góp ý).

## Kế hoạch tuần 9 theo nhánh

| Nhánh | Người | Việc | Output | Gửi review | Merge | Review |
|---|---|---|---|---|---|---|
| `docs/week8-tv2-report` (nhánh cũ) | TV2 Thanh | Sửa mục "Việc đã làm" tuần 8 (bỏ dòng review không có dấu vết) | `tuan-08/TV2_Thanh.md` | T3 (3/11), 21:00 | T4 (4/11) | TV1 |
| `docs/test-report-leave` | TV4 Duy | Kiểm thử chức năng 5 màn hình nghỉ phép trên `dev` theo TC-01 → TC-22, ghi kết quả thực tế | Mục 2 `docs/business/test-report-tuan-08.md`, issue cho từng lỗi | **T3 (3/11), 21:00** | T4 (4/11) | TV1 |
| `docs/adr-12-cloud-provider` (nhánh cũ) | TV3 Bảo | Sửa 2 điểm review của ADR-12 (mạng App Runner, Cognito) | ADR-12 trong mục 3 file này, `docs/cloud/mapping.md` | **T4 (4/11), 21:00** | T5 (5/11) | TV1 |
| `docs/access-control-matrix` | TV2 Thanh | Ma trận phân quyền: vai trò × tài nguyên × thao tác, điều kiện theo dữ liệu | `docs/security/access-control-matrix.md` | **T4 (4/11), 21:00** | T5 (5/11) | TV1, TV4 |
| `feat/secret-config` | TV1 Duong | Production thiếu hoặc dùng secret mặc định thì không khởi động; tách cấu hình secret | PR code | T4 (4/11) | T5 (5/11) | TV3 |
| `ci/docker-images` | TV3 Bảo | CI build image api, worker, web và quét lỗ hổng (Trivy) trên mọi PR | `.github/workflows/` | T5 (5/11), 21:00 | T6 (6/11) | TV1 |
| `docs/leave-rules-br06` | TV2 Thanh | Chốt issue #21, #22 và BR-06 (người duyệt thay) | Cập nhật `docs/business/leave-rules.md`, đóng issue | T5 (5/11), 21:00 | T6 (6/11) | TV1, TV4 |
| `feat/auth-cognito` | TV1 Duong | Xác thực được token của Cognito (staging) lẫn Keycloak (local) | PR code | T5 (5/11) | T6 (6/11) | TV3 |
| `docs/security-test-cases` | TV4 Duy | Ca kiểm thử phân quyền theo ma trận, chạy thử trên local | `docs/business/security-test-cases.md`, `docs/business/test-report-tuan-09.md` | T6 (6/11), 21:00 | T7 (7/11) | TV2, TV1 |
| `docs/threat-model` | TV2 Thanh | Threat model STRIDE | `docs/security/threat-model.md` | T6 (6/11), 21:00 | T7 (7/11) | TV1 |
| `feat/queue-adapter` | TV1 Duong | Tách queue: RabbitMQ khi chạy local, SQS trên AWS | PR code | T6 (6/11) | T7 (7/11) | TV3 |
| `test/access-control-e2e` | TV1 Duong | e2e test cho mọi dòng của ma trận còn thiếu test; sửa chỗ code lệch ma trận | PR code + test | T6 (6/11) | T7 (7/11) | TV2, TV4 |
| `infra/terraform-staging` | TV3 Bảo | Terraform dựng staging trên AWS (kèm `terraform plan`) | `infra/` | **T7 (7/11), 12:00** | T7 (7/11) | TV1 |
| `ci/deploy-staging` | TV3 Bảo | Pipeline deploy staging mỗi khi có commit mới trên `dev` (và chạy tay được); deploy lần đầu | `.github/workflows/deploy-staging.yml`, URL staging | **CN (8/11), 12:00** | CN (8/11) | TV1 |
| `docs/test-report-staging` | TV4 Duy | Smoke test staging với 4 tài khoản | Bổ sung `docs/business/test-report-tuan-09.md` | CN (8/11), 21:00 | T2 (9/11), 9:00 | TV1 |

Thứ tự phụ thuộc:

1. T3: TV4 kiểm thử màn hình nghỉ phép (code đã có trên `dev`).
2. T4: TV2 giao ma trận phân quyền → TV1 viết e2e, TV4 viết ca kiểm thử phân quyền. TV3 chốt ADR-12 → mọi người làm theo AWS.
3. T5: TV1 xong secret + Cognito → TV3 đưa secret và Cognito vào Terraform.
4. T6: TV1 xong queue adapter → worker chạy được với SQS trên staging.
5. T7: TV3 có `terraform plan` để TV1 duyệt rồi mới `apply`.
6. CN: TV3 deploy staging lần đầu trước 12:00 → TV4 smoke test chiều CN.
7. T2 (9/11), 9:00: mọi người điền "Việc đã làm" trong file cá nhân. TV1 viết báo cáo, mở PR `dev` → `main`, gắn tag `week-09`.

**Nếu staging không kịp:** TV3 báo TV1 trước T7 (7/11) 21:00 để cắt phạm vi: staging tối thiểu gồm RDS + API trên App Runner +
web trên S3/CloudFront + Cognito; worker và SQS chuyển sang tuần 10.

## Chi tiết từng người

| Thành viên | File |
|---|---|
| TV1 (Duong, nhóm trưởng) | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | [TV4_Duy.md](TV4_Duy.md) |

## 1. Các công việc đã hoàn thành

Số liệu chốt ngày 9/11/2026, tình trạng PR theo GitHub.

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (Duong, nhóm trưởng) | Secret production, nhận token Cognito, queue adapter RabbitMQ/SQS, e2e theo ma trận phân quyền (36 e2e); BRD và tài liệu kiến trúc; review PR của nhóm | PR #37–#46, #55 (đã merge) | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | Ma trận phân quyền 27/27 API, threat model STRIDE, chốt issue #21, #22, BR-06, BR-12 | PR #35, #36, #48, #49 (đã merge) | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | ADR-12 chọn AWS, CI build và quét image, Terraform staging, pipeline deploy (trễ 1–3 ngày so với hạn) | PR #50–#53 (đã merge) | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | Ca kiểm thử phân quyền SEC-01 → SEC-58 | PR #47 (đã merge); PR #54 do TV1 chạy lại phần kết quả | [TV4_Duy.md](TV4_Duy.md) |

**Chưa làm được theo kế hoạch:**
- **Staging trên AWS:** chưa có `terraform plan` thật, chưa `apply`, chưa deploy lần đầu. Mục tiêu deploy staging của tuần không đạt, chuyển sang đầu tuần 10. Workflow deploy sẽ báo lỗi trên `dev` cho tới khi có hạ tầng.
- **Smoke test staging (TV4):** chưa kiểm vì staging chưa sẵn sàng.
- **Driver SQS:** mới kiểm bằng unit test với client giả.
- **Kiểm thử của TV4:** 6 ca SEC và toàn bộ kết quả TC-01 → TC-22 do TV1 chạy thay, vì kết quả nộp lần đầu không tái hiện được hoặc không có số liệu quan sát được.
- **Review chéo:** TV2, TV3, TV4 chưa để lại review nào trên GitHub cho PR của TV1 (#43–#46).
- **Issue #21, #22:** chưa có comment quyết định; #21 chưa đóng, #22 giữ mở tới khi code xong ở tuần 10.

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 10: 9/11 – 16/11)

Hoàn thiện chức năng. Kế hoạch chi tiết, nhánh và hạn ở [`tuan-10/README.md`](../tuan-10/README.md).

| Thành viên | Công việc | Output |
|---|---|---|
| TV1 (Duong) | Quy tắc một quản lý, HR duyệt đơn CEO; giao diện HR tạo/sửa hồ sơ; kho tài liệu, tìm kiếm; giao diện audit; BR-06, BR-12 nếu còn thời gian | PR code + e2e, ADR-13 |
| TV2 (Thanh) | Quy tắc kho tài liệu; thời gian lưu dữ liệu, quyền xem lý do nghỉ; cập nhật ma trận, BRD, threat model | `document-rules.md`, `leave-rules.md`, ma trận |
| TV3 (Bảo) | MinIO local; `terraform plan` thật (không `apply`); code Terraform tài liệu, email, alarm; kế hoạch lên AWS tuần 12–13 | `infra/` |
| TV4 (Duy) | Ca kiểm thử chức năng mới; chạy và ghi kết quả thật trên local | `test-cases-tuan-10.md`, `test-report-tuan-10.md` |

## 3. Quyết định quan trọng

### ADR-12 – Chọn cloud provider

> Đã chuyển sang file riêng: [ADR-12 – Chọn cloud provider](../../architecture/adr/ADR-12-cloud-provider.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).
