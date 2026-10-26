# Hướng dẫn: khôi phục file bị xóa, gỡ file thừa khỏi git, commit tài liệu tiến độ

Ghi lại các bước đã làm ngày 26/10 để sửa repo, và cách tự làm lại khi gặp tình huống tương tự.
Mọi lệnh chạy trong terminal (Git Bash, PowerShell hoặc terminal của VS Code) ở thư mục gốc repo `D:\Git_repo\HR Enterprise`.

## Tình trạng trước khi sửa

Commit `5455eb6 chore: remove configuration and documentation files` đã:
- xóa `README.md`, `docker-compose.yml`, `.gitignore`, `.editorconfig`, `.gitattributes`;
- thêm nhầm `hr-platform.tgz` (file nén 300 KB dùng để chép repo, không phải mã nguồn).

Hậu quả: không có hướng dẫn chạy, không chạy được `docker compose up`, và vì thiếu `.gitignore` nên lần `git add .` sau
sẽ kéo theo cả `node_modules/` (hàng trăm MB) và file `.env` có mật khẩu.

## Bước 1 – Xem lịch sử để tìm commit còn file

```bash
git log --oneline
# 5455eb6 chore: remove configuration and documentation files
# 3b7eed5 feat: week 7 platform foundation   ← commit này còn đủ file
```

Xem một commit đã xóa/thêm những gì: `git show --stat 5455eb6`.

## Bước 2 – Lấy lại file từ commit cũ

```bash
git checkout 3b7eed5 -- README.md docker-compose.yml .gitignore .editorconfig .gitattributes
```

Lệnh `git checkout <commit> -- <file>` chép file từ commit đó ra thư mục làm việc và đưa luôn vào staging.
Không ảnh hưởng tới file khác, không đổi nhánh.

## Bước 3 – Gỡ file thừa khỏi git

```bash
git rm hr-platform.tgz            # xóa khỏi git và khỏi ổ đĩa
# hoặc: git rm --cached <file>    # chỉ gỡ khỏi git, giữ file trên máy
```

Lưu ý: file đã từng commit vẫn còn trong lịch sử. Với file nhỏ, không chứa bí mật như `hr-platform.tgz` thì để nguyên lịch sử là được.
Nếu lỡ commit mật khẩu hay khóa bí mật thì phải **đổi mật khẩu/khóa đó ngay**, xóa khỏi lịch sử không đủ an toàn.

## Bước 4 – Thêm tài liệu tiến độ và kiểm tra trước khi commit

```bash
git add docs/progress docs/HUONG-DAN-SUA-REPO.md README.md
git status
```

Trước mỗi commit, đọc kỹ `git status`:
- Không được có `node_modules/`, `dist/`, `.env`, `.env.local`, file `.tgz`/`.zip`.
- Nếu thấy, nghĩa là `.gitignore` bị thiếu hoặc sai; gỡ ra bằng `git restore --staged <đường dẫn>`.

## Bước 5 – Commit

```bash
git commit -m "docs: restore project files and add weekly progress"
```

## Bước 6 – Đẩy lên GitHub

```bash
git push origin main
```

Theo `docs/CONVENTIONS.md`, từ nay thay đổi nên đi qua nhánh + Pull Request thay vì push thẳng vào `main`:

```bash
git checkout -b docs/week-8-report
# ... sửa file ...
git add <file>
git commit -m "docs: week 8 report"
git push -u origin docs/week-8-report
# rồi mở Pull Request trên GitHub
```

## Muốn xóa một file khỏi repo thì làm thế nào cho đúng

| Muốn | Lệnh |
|---|---|
| Xóa file khỏi repo và khỏi máy | `git rm <file>` |
| Chỉ ngừng theo dõi (giữ trên máy, ví dụ `.env` lỡ commit) | `git rm --cached <file>` rồi thêm tên file vào `.gitignore` |
| Hoàn tác một commit đã push | `git revert <commit>` (tạo commit mới đảo ngược, an toàn khi làm việc nhóm) |
| Bỏ thay đổi chưa commit của một file | `git restore <file>` |

Không dùng `git reset --hard` hay `git push --force` trên `main` khi cả nhóm đang dùng chung, vì sẽ làm mất commit của người khác.
