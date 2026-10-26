# Tuần 8 – TV4 (Bảo): cloud, IaC và CI/CD

Vai trò: chọn cloud provider, chi phí, CI/CD, hạ tầng bằng code, hạ tầng chạy local.

## Việc cần làm

| Nhánh | Việc | Output | Hạn PR vào `dev` |
|---|---|---|---|
| `chore/rabbitmq-mailpit` | Thêm service RabbitMQ (có management UI) và Mailpit vào `docker-compose.yml`; biến môi trường mẫu trong `.env.example`; ghi cách mở UI vào `README.md` | `docker-compose.yml`, `.env.example`, `README.md` | **Thứ 4 (28/10)**, TV1 cần để viết worker |
| `ci/github-actions` | Workflow chạy khi có PR vào `dev` hoặc `main`: cài dependency, `npm run lint` và `npm test` cho backend, `npm run build` cho frontend | `.github/workflows/ci.yml` | Thứ 4 (28/10) |
| `docs/adr-12-cloud-provider` | So sánh 2–3 cloud provider (credit sinh viên, chi phí, dịch vụ managed cần dùng: database, object storage, identity, queue, container); viết ADR-12 theo khung quyết định; map 7 capability của kiến trúc v1 sang dịch vụ cụ thể; ước tính chi phí/tháng | ADR-12 trong `docs/progress/tuan-08/README.md`, `docs/cloud/mapping.md` | Thứ 6 (30/10) |

Sau khi CI chạy được: nhờ TV1 (chủ repo) bật branch protection cho `main` và `dev` (bắt buộc qua PR, CI phải xanh).

## Cách làm trên git

```bash
git checkout dev && git pull
git checkout -b chore/rabbitmq-mailpit
# sửa file, rồi:
git add docker-compose.yml .env.example README.md
git commit -m "chore(infra): add RabbitMQ and Mailpit to docker-compose"
git push -u origin chore/rabbitmq-mailpit
# lên GitHub mở PR: base = dev. Làm xong nhánh này mới tách nhánh tiếp theo từ dev.
```

## Việc đã làm

_Điền cuối tuần._
