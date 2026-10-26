# Tuần 8 – TV3 (Duy): ca kiểm thử và một phần nghiệp vụ

Vai trò: danh mục và quy định nhỏ (loại phép, ngày lễ), biến business rule thành ca kiểm thử, kiểm thử chức năng cuối tuần.

## Việc cần làm

Nhánh: `docs/leave-test-cases`, hạn PR vào `dev` **thứ 5 (29/10)**. Bắt đầu phần danh mục ngay, phần ca kiểm thử sau khi
business rule của TV2 vào `dev` (thứ 3).

| Việc | Output |
|---|---|
| Danh mục loại phép: tên, số ngày tối đa/năm, có lương hay không, cần giấy tờ gì. Danh sách ngày lễ 2026 | `docs/business/leave-types-holidays.md` |
| Ca kiểm thử cho 5 bước workflow (tạo, duyệt, từ chối, hủy, HR hoàn tất). Mỗi ca: mã (TC-01…), BR liên quan, tài khoản, đầu vào, kết quả mong đợi. Mỗi bước có ít nhất một ca hợp lệ và một ca bị từ chối | `docs/business/leave-test-cases.md` |
| Kiểm thử chức năng các màn hình tuần 7 (đăng nhập, hồ sơ, danh bạ, chi tiết nhân viên, sơ đồ tổ chức) với 4 tài khoản demo `employee`, `manager`, `hr`, `admin` (mật khẩu `Passw0rd!`) | `docs/business/test-report-tuan-08.md`, issue cho từng lỗi |
| Chủ nhật (1/11): kiểm thử chức năng các màn hình nghỉ phép trên `dev` theo các ca kiểm thử | Bổ sung vào biên bản, issue |

Trong tuần:
- Review PR `feat/leave-workflow-api` và `feat/leave-ui` của TV1: kết quả có khớp ca kiểm thử không.
- Các file test tự động có sẵn trong `backend/test/` và `*.spec.ts` có thể dùng làm mẫu khi viết ca kiểm thử.

## Cách làm trên git

```bash
git checkout dev && git pull
git checkout -b docs/leave-test-cases
# viết file, rồi:
git add docs/business/
git commit -m "docs(business): add leave types, holidays and test cases"
git push -u origin docs/leave-test-cases
# lên GitHub mở PR: base = dev, compare = docs/leave-test-cases
```

## Việc đã làm

_Điền cuối tuần._
