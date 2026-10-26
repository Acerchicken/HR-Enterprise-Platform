# Kế hoạch và tiến độ – Enterprise HR Platform

Thư mục này lưu kế hoạch 10 tuần và báo cáo tiến độ hàng tuần của nhóm. Mỗi báo cáo thứ 2 đăng lên thread
`[Tên nhóm]_Enterprise HR Platform` trên Discussions được lấy từ file `README.md` của tuần tương ứng.

## Mục lục

| Tuần | Thời gian | Nội dung | File |
|---|---|---|---|
| 4 | 28/9 – 5/10 | Khởi động, phạm vi MVP, phân vai, kế hoạch tổng 10 tuần | [tuan-04-ke-hoach-tong.md](tuan-04-ke-hoach-tong.md) |
| 5 | 5/10 – 12/10 | P1 – Business, Requirements & Cloud Architecture | [tuan-05/](tuan-05/README.md) |
| 6 | 12/10 – 19/10 | P2 – Application, Data & Integration Architecture | [tuan-06/](tuan-06/README.md) |
| 7 | 19/10 – 26/10 | Implementation 1 – Nền tảng (code) | [tuan-07/](tuan-07/README.md) |
| 8 | 26/10 – 2/11 | Implementation 2 – Workflow nghỉ phép (kế hoạch, điền kết quả cuối tuần) | [tuan-08/](tuan-08/README.md) |

## Cách tổ chức

- `tuan-04-ke-hoach-tong.md`: kế hoạch tổng của cả dự án, phân vai, phạm vi MVP.
- Mỗi tuần từ tuần 5 là một thư mục:
  - `README.md`: bảng tóm tắt việc đã hoàn thành, tóm tắt kế hoạch tuần sau, các quyết định quan trọng của tuần.
  - `TV1.md` … `TV4.md`: chi tiết phần việc và output của từng thành viên.
- Mỗi quyết định quan trọng ghi theo cùng một khung:
  1. **Bối cảnh**: vấn đề và ràng buộc.
  2. **Các giải pháp** đã cân nhắc.
  3. **Tiêu chí lựa chọn**: bảng chấm điểm 1–5 cho từng phương án theo từng tiêu chí (5 = tốt nhất). Điểm là đánh giá của nhóm dựa trên NFR và ràng buộc của đồ án.
  4. **Giải pháp được chọn** và lý do.
  5. **Trade-off** chấp nhận được.
  6. **Tiêu chí nghiệm thu**: cách kiểm chứng giải pháp đã chọn đáp ứng đúng yêu cầu.
  7. **Khi nào xem lại**: điều kiện khiến nhóm phải đổi quyết định.

## Phân vai

Tuần 4–6 theo phân vai ban đầu (bảng dưới). Từ tuần 7 điều chỉnh theo [ADR-11](tuan-07/README.md#adr-11--điều-chỉnh-phân-vai-cho-giai-đoạn-code):

| Mã | Thành viên (từ tuần 7) | Vai trò từ tuần 8 |
|---|---|---|
| TV1 | Duong – nhóm trưởng | Code chính (backend, frontend), kiến trúc, review và merge PR, báo cáo thứ 2 |
| TV2 | Thanh | Nghiệp vụ: business rule, quy trình, đối chiếu với requirements |
| TV3 | Duy | Một phần nghiệp vụ (danh mục, quy định nhỏ) và ca kiểm thử, kiểm thử chức năng |
| TV4 | Bảo | Cloud, IaC và CI/CD |

Lưu ý: từ tuần 7, TV1 (Duong) và TV2 (Thanh) giữ nguyên mã như tuần 4–6; Duy là TV3 (tuần 4–6 là TV4), Bảo là TV4 (tuần 4–6 là TV3).

Phân vai ban đầu (tuần 4–6):

| Mã | Thành viên | Vai trò | Phụ trách chính |
|---|---|---|---|
| TV1 | Duong – nhóm trưởng | Project lead + Solution architect | Kế hoạch, báo cáo thứ 2, kiến trúc và ADR, review code; module Leave; AI assistant (tuần 12) |
| TV2 | Thanh | Backend developer | Data model, API spec; module Employee, Organization, Identity & Access, Audit, Search |
| TV3 | Bảo | Frontend developer + Business analyst | Requirements, NFR, user journey; giao diện SPA; kiểm thử chức năng |
| TV4 | Duy | DevOps / Cloud engineer | Cloud, container, CI/CD, IaC; module Document, queue + worker; monitoring, load test |

## Danh sách quyết định (ADR)

ADR (Architecture Decision Record) là bản ghi một quyết định kiến trúc: bối cảnh, phương án, lựa chọn, lý do, đánh đổi.

| Mã | Quyết định | Tuần |
|---|---|---|
| ADR-00 | Dùng managed services cho database, storage, identity | 5 |
| ADR-01 | Modular monolith thay vì microservices | 6 |
| ADR-02 | PostgreSQL thay vì NoSQL | 6 |
| ADR-03 | Workflow đồng bộ, thông báo và index bất đồng bộ (outbox + queue) | 6 |
| ADR-04 | Tech stack: NestJS + React + PostgreSQL + Keycloak | 7 |
| ADR-05 | Phạm vi MVP: một luồng nghiệp vụ nghỉ phép end-to-end | 4 |
| ADR-06 | Mục tiêu availability 99.5%, thiết kế cho 50 RPS | 5 |
| ADR-07 | Không dùng Redis ở MVP, cache in-memory cho dữ liệu tham chiếu | 6 |
| ADR-08 | Mã hóa trường nhạy cảm ở tầng ứng dụng | 7 |
| ADR-09 | Audit log append-only khóa ở mức database | 7 |
| ADR-10 | Role MANAGER suy ra từ sơ đồ tổ chức | 7 |
| ADR-11 | Điều chỉnh phân vai cho giai đoạn code | 7 |

ADR-00 → ADR-04 được đánh số ngay khi ra quyết định. ADR-05 → ADR-11 là các quyết định được ghi lại sau theo cùng khung,
nên số thứ tự không trùng với thứ tự tuần. ADR tiếp theo bắt đầu từ ADR-12.