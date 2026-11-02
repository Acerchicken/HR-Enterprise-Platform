# Tuần 9 – TV1 (Duong, nhóm trưởng): bảo mật tầng ứng dụng, sẵn sàng chạy trên AWS

Vai trò: code chính, review trên nhánh và ghi góp ý vào file cá nhân của từng người, merge PR, báo cáo thứ 2.

## Hạn chót

| Hạn | Việc |
|---|---|
| Trong 24 giờ kể từ khi nhận link | Review nhánh của TV2, TV3, TV4; ghi góp ý vào mục "Góp ý review" trong file của người đó trên `dev` |
| **T4 (4/11)** | Gửi link nhánh `feat/secret-config` cho TV3 review |
| **T5 (5/11)** | Gửi link nhánh `feat/auth-cognito` (sau khi ADR-12 chốt Cognito) |
| **T6 (6/11)** | Gửi link nhánh `feat/queue-adapter` và `test/access-control-e2e` (sau khi ma trận của TV2 merge T5) |
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

- Review trên nhánh theo quy trình mới: đọc link compare, ghi góp ý vào mục "Góp ý review" của file cá nhân người làm (commit
  thẳng lên `dev`, chỉ sửa `docs/progress/`), cập nhật trạng thái khi người làm báo đã sửa.
- Chỉ approve PR khi mọi góp ý "cần sửa" đã xử lý; PR không đạt thì đóng.
- T7: đọc `terraform plan` của TV3 (không mở port DB ra internet, không có secret trong code/output, IAM tối thiểu) trước khi
  cho `apply`.
- T2 (9/11): điền báo cáo, PR `dev` → `main` bằng merge commit, tag `week-09` và tạo Release.

## Cách làm trên git (quy trình mới)

```bash
git checkout dev && git pull
git checkout -b feat/secret-config
# code, npm run lint && npm test, rồi:
git push -u origin feat/secret-config
```

Gửi link `https://github.com/Acerchicken/HR-Enterprise-Platform/compare/dev...feat/secret-config` cho người review trong nhóm
chat. Hết góp ý "cần sửa" mới mở PR; PR của TV1 merge bằng quyền bypass sau khi CI xanh.

## Góp ý review

_Người review gửi góp ý cho TV1 trong nhóm chat; TV1 ghi lại vào đây. Mỗi dòng: ngày, nhánh, người góp ý, nội dung ("cần sửa"
hoặc "nit:"), trạng thái._

| Ngày | Nhánh | Người góp ý | Góp ý | Trạng thái |
|---|---|---|---|---|

## Việc đã làm

_Điền T2 (9/11)._
