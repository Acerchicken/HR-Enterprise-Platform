# ADR-14 – Cây đơn vị tổ chức có loại đơn vị, số cấp linh hoạt

| Mục | Nội dung |
|---|---|
| Trạng thái | Đề xuất |
| Ngày quyết định | 15/11/2026 (Duong chọn phương án; đổi thành ngày merge PR) |
| Thời điểm | Tuần 10 (9/11 – 16/11/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Nghiệp vụ |
| ADR liên quan | ADR-10 |
| Yêu cầu liên quan | FR-2.2, FR-2.4, FR-2.5, FR-2.9, FR-2.10 (SRS); BR-05 |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** Duong muốn công ty có cây cấp bậc Công ty → Trung tâm → Phòng ban: công ty có CEO, trung tâm có Giám đốc, phòng
ban có trưởng phòng và phó phòng. Hiện bảng `org.department` là một cây không phân loại: gốc "Ban Giám đốc", dưới là các
"Khối", dưới nữa là phòng. Một số phòng (Marketing, Pháp chế) nằm thẳng dưới gốc. Bản vẽ giao diện UC2 đã vẽ thêm cấp Nhóm
dưới phòng. FR-2.9 chỉ có trưởng, phó cho phòng ban và bắt trưởng phòng phải thuộc chính phòng đó.

Ngoài thực tế (doanh nghiệp Việt Nam cỡ 2.000 người):

- Phòng có thể nằm thẳng dưới công ty, không qua trung tâm (Pháp chế, Kiểm soát nội bộ, Văn phòng Tổng Giám đốc).
- Dưới phòng thường có tổ, nhóm.
- Cấp nào cũng có trưởng và phó: Tổng Giám đốc và Phó Tổng Giám đốc, Giám đốc trung tâm và Phó Giám đốc, Trưởng phòng và
  Phó phòng.
- Có "Quyền trưởng phòng" (người phụ trách khi chưa bổ nhiệm chính thức) và kiêm nhiệm (Giám đốc trung tâm kiêm trưởng một
  phòng của trung tâm).
- Giám đốc trung tâm có thể báo cáo Phó Tổng Giám đốc phụ trách, không phải lúc nào cũng báo cáo thẳng CEO.
- Đơn vị bị giải thể, sáp nhập.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Cây linh hoạt có loại đơn vị | Giữ một bảng cây `org.department`, thêm cột loại đơn vị (`COMPANY`, `CENTER`, `DEPARTMENT`, `TEAM`) và luật loại cha, loại con. Số cấp thay đổi theo nhánh. Trưởng và phó áp dụng cho mọi loại |
| B | Đúng 3 cấp cứng | Mọi phòng phải thuộc một trung tâm, mọi trung tâm thuộc công ty. Phòng đứng riêng phải đặt vào một trung tâm giả |
| C | Giữ nguyên | Cây không phân loại; tên đơn vị tự nói lên cấp ("Khối…", "Phòng…") |

**Tiêu chí lựa chọn** (điểm 1–5, không trọng số):

| Tiêu chí | A | B | C |
|---|---|---|---|
| Khớp tổ chức thực tế (phòng thẳng dưới công ty, nhóm dưới phòng) | 5 | 2 | 4 |
| Hệ thống biết đơn vị thuộc cấp nào (tên vai trò trưởng, phó; luật cha con; báo cáo theo trung tâm) | 5 | 5 | 1 |
| Không phải viết lại code đã có (cây, phạm vi tài liệu UC5 theo phòng ban con) | 5 | 3 | 5 |
| Công sức làm thêm | 3 | 3 | 5 |
| **Tổng** | **18** | **13** | **15** |

**Giải pháp được chọn:** A (Duong chọn 15/11/2026).

Quy tắc chi tiết:

1. **Loại đơn vị và luật cha con.**

   | Loại | Tên hiển thị | Cha hợp lệ | Trưởng | Phó (tối đa) |
   |---|---|---|---|---|
   | `COMPANY` | Công ty | Không có, đúng một đơn vị, là gốc | Tổng Giám đốc (CEO) | Phó Tổng Giám đốc (5) |
   | `CENTER` | Trung tâm | `COMPANY` | Giám đốc trung tâm | Phó Giám đốc trung tâm (3) |
   | `DEPARTMENT` | Phòng | `COMPANY` hoặc `CENTER` | Trưởng phòng | Phó phòng (3) |
   | `TEAM` | Nhóm | `DEPARTMENT` | Trưởng nhóm | Không có |

   Đổi loại một đơn vị chỉ được khi luật cha con của chính nó và của các đơn vị con vẫn đúng.
2. **Trưởng đơn vị là vai trò của đơn vị, quản lý trực tiếp là quan hệ giữa hai người** (giữ quyết định 14/11 của FR-2.9).
   Quyền duyệt đơn nghỉ vẫn theo quản lý trực tiếp (BR-05). Phó không tự có quyền duyệt.
3. **Ai được làm trưởng, phó:** nhân viên đang làm việc, thuộc chính đơn vị đó **hoặc một đơn vị cha của nó** (kiêm nhiệm:
   Giám đốc trung tâm kiêm trưởng phòng). Một người làm trưởng nhiều đơn vị được.
4. **Quyền trưởng:** trưởng đơn vị có cờ `acting` ("Quyền Trưởng phòng", "Phụ trách"). Chỉ khác tên hiển thị, không khác quyền.
5. **CEO** là trưởng của đơn vị `COMPANY` và thuộc đơn vị đó. FR-2.5 giữ nguyên: CEO là người duy nhất không có quản lý trực
   tiếp. Đơn nghỉ của CEO do HR xử lý (UC4 E8).
6. **Gợi ý quản lý trực tiếp mặc định** khi tạo, điều chuyển nhân viên: trưởng của chính đơn vị; nếu người đó là trưởng đơn vị
   thì lấy trưởng của đơn vị cha gần nhất có trưởng. HR đổi được, ví dụ cho Giám đốc trung tâm báo cáo một Phó Tổng Giám đốc.
7. **Ngừng hoạt động đơn vị** thay cho xóa: chỉ được khi không còn nhân viên đang làm việc và không còn đơn vị con đang hoạt
   động. Đơn vị ngừng hoạt động ẩn khỏi cây và danh sách chọn, vẫn hiện trong quá trình công tác. Sáp nhập là điều chuyển hết
   người sang đơn vị mới rồi ngừng đơn vị cũ.
8. **Dữ liệu:** giữ tên bảng `org.department` và API `/departments` (tránh đổi code đang chạy). Thêm cột `unit_type`, `status`,
   `head_acting`; bảng phó `org.department_deputy` dùng cho mọi loại. Giao diện gọi chung là "đơn vị".

**Trade-off:**

- Thêm một migration và kiểm tra luật cha con ở service; seed phải đổi lại (gốc thành Công ty, Khối thành Trung tâm, thêm
  Nhóm). Giảm thiểu: làm cùng nhánh `fix/employee-org-integrity` đã có kế hoạch, test e2e cây sửa cùng lúc.
- Không làm tổ chức ma trận (một người thuộc nhiều đơn vị), trung tâm chi phí, định biên. Một người chỉ thuộc một đơn vị chính.
- Lịch sử đổi tên, đổi cha của đơn vị chỉ có trong audit, không có bảng hiệu lực theo ngày cho đơn vị (chỉ nhân viên có, FR-2.8).

**Tiêu chí nghiệm thu:**

- Cây seed có đúng một `COMPANY`; mọi `CENTER` có cha `COMPANY`; phòng nằm dưới công ty hoặc trung tâm; nhóm nằm dưới phòng.
- API trả 400 khi tạo, sửa đơn vị sai luật cha con (AC-2.4.8), gán trưởng, phó sai luật (AC-2.9.1), ngừng đơn vị còn người
  (AC-2.10.1).
- Sơ đồ tổ chức hiện đúng tên vai trò theo loại (Giám đốc trung tâm, Trưởng phòng, Trưởng nhóm) và nhãn "Quyền".

**Khi nào xem lại:** cần một người thuộc nhiều đơn vị cùng lúc (ma trận, dự án), cần báo cáo chi phí theo đơn vị, hoặc công ty
có nhiều pháp nhân (công ty con).
