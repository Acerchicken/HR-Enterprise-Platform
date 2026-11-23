# ADR-15 – Tách Notification và Search (nay là Assistant) thành service riêng qua event

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đề xuất** (Duong chọn phương án B ngày 15/11/2026) |
| Ngày quyết định | Ngày merge PR |
| Thời điểm | Tuần 11 (16/11 – 23/11/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Cả hai |
| ADR liên quan | ADR-01, ADR-03, ADR-06, ADR-07, ADR-09, ADR-12, ADR-13, ADR-16 |
| Yêu cầu liên quan | FR-6.3, AC-6.3.2, AC-6.3.4, AC-6.3.7, NFR-3.5 (SRS). FR-6.2 đã bỏ ngày 22/11/2026 |

## Lịch sử thay đổi

- 15/11/2026: bản đề xuất đầu tiên, sau khi đánh giá việc chuyển sang microservice. Duong chọn phương án B trên thẻ quyết
  định của thread "Đánh giá chuyển sang microservice".
- 22/11/2026: kiểm chéo UC5. Không gửi email khi có tài liệu mới (UC5 D2), nên sửa tiêu chí nghiệm thu về upload tài liệu:
  notification service nhận event nhưng bỏ qua loại `document.*`. Event tài liệu: [UC5 spec 13.2](../../features/UC5-document-repository/spec.md#132-event-cho-trợ-lý-adr-15).
- 23/11/2026: UC6 thu gọn còn trợ lý (Duong, 22/11), bỏ tìm tài liệu theo từ khóa (FR-6.2). Search service đổi tên thành
  **assistant service** (`services/assistant/`, schema `assistant`, DB user `assistant_svc`, queue `assistant.document`); index
  là đoạn văn bản có full-text và vector theo [ADR-16](ADR-16-policy-assistant.md). Phương án B và các tiêu chí khác giữ nguyên.

## Nội dung quyết định

**Bối cảnh:**

- Nhóm muốn trình diễn thêm kỹ thuật của hệ thống phân tán (service độc lập, event, tracing) để bảo vệ đồ án.
- ADR-01 chọn modular monolith và ghi sẵn điều kiện xem lại: "Ứng viên tách đầu tiên: Notification và AI assistant".
- Thời gian còn lại ngắn: feature freeze 2/12/2026, UC2 → UC7 chưa xong, chỉ TV1 code (ADR-11).
- Duyệt đơn phải cập nhật đơn, số dư, lịch sử và audit trong **một transaction** (ADR-01, ADR-09). Audit được ghi đồng bộ
  trong transaction của mọi module có thao tác ghi.
- Ngân sách AWS: dự toán 56,80 USD/tháng khi chạy 24/7, hạn mức thẻ 60 USD (ADR-12).
- Hiện trạng: đã có transactional outbox (`leave.outbox`), driver RabbitMQ/SQS (`src/messaging/`), worker gửi email chạy
  process riêng. Nhưng worker dùng chung image và DB user với API, import `EmployeeService` và đọc thẳng bảng `iam.*` để lấy
  email người nhận, nên chưa phải service độc lập.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Giữ nguyên | Modular monolith + 1 worker như hiện tại, chỉ thêm observability |
| B | Monolith + 2 service tách qua event | Lõi (identity, employee, organization, leave, document, audit) giữ trong API; Notification và Search thành service riêng: code, image, DB user, schema riêng, chỉ nhận event |
| C | Microservice toàn phần | Mỗi module một service, database riêng, gọi nhau qua REST/event, Saga cho duyệt đơn |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Xong kịp trước 2/12 cùng UC2 → UC7 | 5 | 4 | 1 |
| Giữ đúng transaction duyệt đơn + số dư + audit | 5 | 5 | 2 |
| Có kỹ thuật phân tán để trình diễn (event, tracing, gateway) | 2 | 5 | 5 |
| Chi phí AWS trong hạn mức 60 USD | 5 | 4 | 1 |
| Rủi ro hỏng tính năng đã chạy (UC1) | 5 | 4 | 1 |
| Nhất quán với ADR đã chấp nhận (ADR-01, 06, 07, 12) | 5 | 4 | 1 |

**Giải pháp được chọn:** B. Có service tách thật để trình diễn mà không đụng transaction của luồng nghiệp vụ lõi. Đây là
bước "kích hoạt điều kiện xem lại" của ADR-01, không thay thế ADR-01: phần lõi vẫn là modular monolith.

Cụ thể:

1. **Notification service** (từ worker hiện có)
   - Code ở `services/notification/`, `package.json` và Dockerfile riêng, không import code trong `backend/`.
   - Không đọc dữ liệu của module khác. API ghi sẵn thông tin người nhận vào payload lúc ghi outbox (event-carried state
     transfer): `recipientEmail`, `recipientName`; event gộp cho HR mang danh sách email HR. Chỉ gửi email và tên, không
     gửi trường nhạy cảm (ADR-08).
   - DB user `notification_svc` chỉ có quyền trên schema `notification`.
2. **Assistant service** (UC6 FR-6.3; trước 23/11 là search service cho cả FR-6.2)
   - Module document phát event qua `document.outbox` (quy tắc 3 của [event-contract](../event-contract.md)): phiên bản
     `READY`, tài liệu bị ẩn, đổi phạm vi.
   - Assistant service nhận event, đọc file từ S3 bằng quyền chỉ đọc, trích text, chia đoạn, ghi index full-text và vector
     (pgvector) vào schema `assistant` (PostgreSQL, không thêm OpenSearch; chi tiết ở [ADR-16](ADR-16-policy-assistant.md)).
     DB user `assistant_svc` chỉ có quyền trên schema `assistant`.
   - Khi hỏi, API (vai trò BFF) tính phạm vi hiện tại của người dùng rồi gọi nội bộ assistant service kèm phạm vi đó. Assistant
     service lọc theo phạm vi trong truy vấn (ADR-13) trước khi gửi đoạn văn bản cho LLM. Nhờ vậy đổi đơn vị có hiệu lực ngay
     (AC-6.3.7, DR-06) và tài liệu ngoài phạm vi không lộ (AC-6.3.2, DR-08). Service không giữ bản sao đơn vị của nhân viên.
   - Gọi LLM có timeout 10 giây, lỗi thì trả danh sách tài liệu (AC-6.3.4).
3. **Fan-out event:** một event đến nhiều queue. Local: thêm queue `assistant.document` bind vào exchange `hr.events` có sẵn.
   AWS: thêm SNS topic `hr-events` trước các queue SQS, lọc theo loại event (subscription filter policy).
4. **Truy vết phân tán:** OpenTelemetry cho API và hai service; `traceparent` đi theo message attribute/header qua outbox và
   queue. Local xem bằng Jaeger (docker-compose profile `observability`), AWS dùng X-Ray.
5. **Giữ nguyên trong monolith:** identity, employee, organization, leave, document, audit. Một database PostgreSQL (RDS)
   duy nhất; mỗi service có schema và DB user riêng (database-per-service ở mức logic).

**Không làm:** Kubernetes/EKS (ADR-06), Kafka/MSK (ADR-03), Redis (ADR-07), Amazon MQ, service mesh, mỗi service một RDS,
tách audit/employee/leave.

**Trade-off:**

- Thêm 1 image và 1 task Fargate (assistant) trên AWS, khoảng 9 USD/tháng nếu chạy 24/7, vượt hạn mức 60 USD. Giảm thiểu: tắt
  ngoài giờ demo như các thành phần khác (`infra/README.md` mục 5.3), hoặc chạy notification và assistant chung một task
  Fargate (hai container). TV3 tính lại chi phí trước khi dựng staging.
- Index của trợ lý trễ vài giây sau khi upload (eventual consistency). Phạm vi người dùng vẫn tính đồng bộ nên không lộ dữ liệu.
- Payload event có email người nhận (dữ liệu cá nhân) đi qua queue. Giảm thiểu: SQS mã hóa KMS, RabbitMQ chỉ trong mạng nội bộ.
- Thêm việc cho TV1 khoảng 7 ngày công. Giảm thiểu: tính năng UC luôn ưu tiên; hạ tầng giao TV3, kịch bản kiểm thử giao TV4.

**Tiêu chí nghiệm thu:**

- `services/notification` và `services/assistant` không import file nào trong `backend/` (kiểm tra trong CI).
- DB user `notification_svc`, `assistant_svc` truy vấn schema khác bị PostgreSQL từ chối.
- Tắt notification service, duyệt đơn vẫn thành công; bật lại thì email được gửi bù (giữ tiêu chí ADR-03).
- Upload một tài liệu: cùng một event `DocumentPublished` đến cả hai queue; assistant service cập nhật index, notification
  service nhận và bỏ qua (không gửi email, UC5 D2); hai service không gọi nhau.
- Một trace trên Jaeger (local) và X-Ray (staging) đi từ request duyệt đơn qua outbox, queue tới notification service.
- AC-6.3.2 và AC-6.3.7 đạt khi câu hỏi đi qua assistant service.

**Khi nào xem lại:** một module trong lõi cần scale hoặc release độc lập; chi phí thực tế vượt ngân sách ADR-12; hoặc nhiều
consumer cần đọc lại lịch sử event (cân nhắc event stream theo ADR-03).
