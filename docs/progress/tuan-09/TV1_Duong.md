# Tuần 9 – TV1 (Duong, nhóm trưởng): bảo mật tầng ứng dụng, sẵn sàng chạy trên AWS

Vai trò: code chính, review trên nhánh và ghi góp ý vào file cá nhân của từng người, merge PR, báo cáo thứ 2.

## Hạn chót

| Hạn | Việc |
|---|---|
| Trong 24 giờ kể từ khi PR mở | Review PR của TV2, TV3, TV4, góp ý ngay trên PR |
| **T4 (4/11)** | Mở PR nhánh `feat/secret-config` cho TV3 review |
| **T5 (5/11)** | Mở PR nhánh `feat/auth-cognito` (sau khi ADR-12 chốt Cognito) |
| **T6 (6/11)** | Mở PR nhánh `feat/queue-adapter` và `test/access-control-e2e` (sau khi ma trận của TV2 merge T5) |
| **T7 (7/11)** | Duyệt `terraform plan` của TV3 trước khi `apply` |
| **T2 (9/11)** | Báo cáo tuần 9 (mục 1–3 `README.md`), tạo thư mục tuần 10, PR `dev` → `main` (merge commit), tag `week-09` |

## Việc cần làm

### 1. `feat/secret-config` – quản lý secret ở tầng ứng dụng

- `loadConfig()`: khi `NODE_ENV=production`, **không khởi động** nếu thiếu `FIELD_ENCRYPTION_KEY`, `DB_PASSWORD`, `OIDC_ISSUER`
  hoặc nếu `FIELD_ENCRYPTION_KEY` vẫn là khóa mặc định dùng cho dev; báo lỗi nêu tên biến, không in giá trị.
- Kiểm tra khóa mã hóa đúng 32 byte khi khởi động (hiện chỉ lỗi khi mã hóa lần đầu).
- Không log biến môi trường; rà lại log lỗi của `ApiErrorFilter` và worker xem có lộ dữ liệu nhạy cảm không.
- `docker-compose.yml` giữ secret dev như cũ (chỉ cho local); ghi trong `README.md` secret production lấy từ Secrets Manager
  (TV3 nạp qua Terraform).
- Unit test cho `loadConfig()` với từng trường hợp thiếu/sai.
- Ghi quyết định thành ADR-13 (quản lý secret) trong mục 3 `README.md` tuần 9 nếu đổi cách làm so với ADR-08.

### 2. `feat/auth-cognito` – xác thực token Cognito

- `token-verifier.ts`: cấu hình được claim xác định client (`azp` cho Keycloak, `client_id` cho access token Cognito) và claim
  chứa nhóm (`realm_access.roles` hoặc `cognito:groups`) qua biến môi trường, mặc định giữ hành vi Keycloak hiện tại.
- Access token của Cognito **không có claim `email`** (hiện `token-verifier.ts` bắt buộc có `sub` và `email`). Chọn một cách và
  ghi lại: gọi endpoint `userInfo` của Cognito rồi cache theo `sub`, hoặc khớp tài khoản theo `sub`/`username` (đặt username =
  email công ty khi TV3 tạo user), hoặc thêm email vào access token bằng Lambda pre-token-generation (tốn thêm hạ tầng).
- Map nhóm Cognito `employee`, `manager`, `hr`, `admin` sang role như Keycloak; giữ nguyên quy tắc MANAGER suy ra từ sơ đồ tổ
  chức (ADR-10) và role HR/ADMIN từ `iam.role_assignment`.
- Frontend: `oidc-client-ts` trỏ được sang Cognito Hosted UI qua `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`; kiểm tra logout
  của Cognito (khác endpoint của Keycloak).
- Unit test với token mẫu kiểu Keycloak và kiểu Cognito (ký bằng khóa test).

### 3. `feat/queue-adapter` – RabbitMQ khi local, SQS trên AWS

- Interface `EventBus` (publish) và `EventConsumer` (consume) dùng chung cho `OutboxPublisher` và `NotificationWorker`; chọn
  driver bằng `QUEUE_DRIVER=rabbitmq|sqs`.
- Adapter SQS: publish với `MessageDeduplicationId`/thuộc tính `messageId` = id outbox; worker xóa message sau khi xử lý xong;
  lỗi để SQS đưa vào DLQ theo `maxReceiveCount` (TV3 cấu hình trong Terraform).
- Giữ nguyên chống trùng bằng `notification.processed_event`.
- Test: unit test cho cả hai adapter với client giả; chạy lại thử nghiệm tắt broker như tuần 8 với RabbitMQ.

### 4. `test/access-control-e2e` – e2e test theo ma trận phân quyền

- Với mỗi dòng của `docs/security/access-control-matrix.md` (TV2) chưa có e2e: thêm một ca được phép và một ca bị chặn trong
  `backend/test/app.e2e-spec.ts`. Bổ sung luôn TC-04, TC-21, TC-22 của `leave-test-cases.md` còn thiếu e2e.
- Chỗ nào code khác ma trận: sửa code hoặc ghi lại để TV2 quyết định, không tự đổi yêu cầu.
- Sửa 2 lỗi dữ liệu trong biên bản tuần 8: e2e tạo "Phòng test" thì dọn lại sau test (L-01); seed sinh ngày vào làm sau ngày
  sinh ít nhất 18 năm (L-02).

### 5. Việc của nhóm trưởng

- Review trên PR: comment theo dòng, "Request changes" khi có góp ý "cần sửa"; xem lại khi người làm bấm "Re-request review".
- Chỉ approve PR khi mọi góp ý "cần sửa" đã xử lý. PR chưa đạt thì để mở cho người làm sửa tiếp; chỉ đóng khi việc bị hủy,
  hướng làm sai hoàn toàn hoặc PR trùng.
- T7: đọc `terraform plan` của TV3 (không mở port DB ra internet, không có secret trong code/output, IAM tối thiểu) trước khi
  cho `apply`.
- T2 (9/11): điền báo cáo, PR `dev` → `main` bằng merge commit, tag `week-09` và tạo Release.

## Chuẩn bị cho tuần 10 (đã chốt 5/11, đưa vào kế hoạch tuần 10)

### `feat/hr-employee-form` – HR tạo và sửa hồ sơ nhân viên trên giao diện

Hiện API đã có (`POST /employees`, `PATCH /employees/{id}`, chỉ HR sửa mọi trường) nhưng giao diện chỉ cho xem. Việc này hoàn
thiện phần "HR cập nhật hồ sơ" của UC1.

**Màn hình (chỉ HR):**
- `/employees/new`: tạo nhân viên. Nút "Tạo nhân viên" ở trang Danh bạ.
- `/employees/:id/edit`: sửa hồ sơ, **dùng chung một form** với màn hình tạo. Nút "Sửa hồ sơ" ở trang chi tiết.
- Trang "Hồ sơ của tôi" của nhân viên giữ form rút gọn (điện thoại, địa chỉ) nhưng dùng cùng bộ mô tả trường bên dưới.

**Trường, chia nhóm:**
- Cơ bản: mã nhân viên, họ tên, email công ty, điện thoại, ngày sinh, địa chỉ.
- Công việc:
  - Phòng ban (chọn từ `GET /departments`), chức danh (chọn từ `GET /positions`), ngày vào làm; trạng thái chỉ hiện khi sửa.
  - **Quản lý trực tiếp:** ô tìm kiếm gợi ý từ `GET /employees?q=`, bỏ nhân viên `TERMINATED`, gợi ý sẵn trưởng phòng của
    phòng ban vừa chọn.
  - Bắt buộc chọn quản lý, trừ chức danh CEO (quyết định issue #22). Lỗi vòng lặp quản lý (backend đã chặn) hiện ngay dưới ô.
- Nhạy cảm (nhóm riêng, chỉ HR): CCCD, số tài khoản, lương. Cần mở rộng `CreateEmployeeDto` để nhận các trường này khi tạo
  (hiện chỉ `PATCH` nhận); audit chỉ ghi tên trường, không ghi giá trị như khi sửa.

**Thiết kế để sau này thêm trường hồ sơ ít phải sửa code:**
1. **Một nguồn mô tả trường duy nhất ở frontend:** `frontend/src/pages/employee/employee-fields.ts`, là mảng
   `FieldDef { key, label, group, type, required, sensitive, editableBy, showOnCreate, options? }`. Giá trị `type` gồm
   `text`, `email`, `date`, `select`, `employee`, `money`… Form tạo/sửa, trang chi tiết và form rút gọn đều render từ mảng này.
   Thêm một trường thường chỉ cần thêm một dòng `FieldDef`.
2. **Component input theo `type`** (`FieldInput`), không viết JSX riêng cho từng trường. Loại input mới, ví dụ upload file,
   chỉ thêm một nhánh ở đây.
3. **Kiểu dữ liệu sinh từ OpenAPI:** dùng `openapi-typescript` sinh type từ `docs/openapi.yaml` (script `npm run gen:api`),
   thay cho interface viết tay trong `client.ts`. Thêm trường ở DTO backend → `npm run openapi` → `npm run gen:api` →
   TypeScript báo các chỗ chưa xử lý.
4. **Backend vẫn là nơi validate** (class-validator trong DTO), frontend chỉ kiểm tra cơ bản (bắt buộc, định dạng).
   `ApiErrorFilter` trả thêm `fields: { <tên trường>: <lỗi> }` cho lỗi validation để form hiện lỗi đúng ô.
5. **Quyền sửa theo vai trò để ở một chỗ:** `employee-access.ts` (`SELF_EDITABLE`, trường nhạy cảm) là nguồn chuẩn.
   Unit test kiểm `editableBy` trong `FieldDef` khớp với `employee-access.ts`, để hai bên không lệch.
6. **Checklist "thêm một trường hồ sơ"** ghi vào `CONVENTIONS.md`: migration + entity + DTO + `FieldDef` + `npm run openapi` /
   `gen:api` + dòng trong ma trận phân quyền (TV2) + ca kiểm thử (TV4). Trường nhạy cảm thêm bước `FieldCrypto`.

**Kiểm thử:**
- e2e:
  - HR tạo nhân viên có quản lý → 201.
  - Nhân viên thường gọi `POST /employees` → 403.
  - Chức danh khác CEO mà không có quản lý → 400 (sau khi code quyết định issue #22).
  - Tạo kèm trường nhạy cảm: audit chỉ ghi tên trường.
- Chạy thử giao diện với `hr`, `employee` và `admin`: `employee` và `admin` không thấy nút tạo/sửa, và gọi thẳng URL thì
  bị chặn.

**Phụ thuộc:** quyết định issue #22 (nhánh `docs/leave-rules-br06` của TV2); TV2 cập nhật ma trận phân quyền; TV4 viết ca
kiểm thử cho màn hình mới.

## Cách làm trên git (quy trình mới)

```bash
git checkout dev && git pull
git checkout -b feat/secret-config
# code, npm run lint && npm test, rồi:
git push -u origin feat/secret-config
```

Mở PR vào `dev`, người review góp ý trên PR, sửa trên cùng nhánh tới khi đạt. PR của TV1 merge bằng quyền bypass sau khi CI
xanh và người review đã xem.

## Góp ý review

_Từ 7/11 góp ý ghi trực tiếp trên PR (CONVENTIONS mục 6). Bảng dưới là góp ý trước 7/11, giữ làm lịch sử; mục "Cần sửa" nào còn mở thì người làm xử lý trên PR của nhánh đó._

| Ngày | Nhánh | Người góp ý | Góp ý | Trạng thái |
|---|---|---|---|---|

## Việc đã làm

_Điền T2 (9/11)._
