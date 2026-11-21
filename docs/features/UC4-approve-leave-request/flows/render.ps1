# Xuất mỗi sơ đồ trong flows.html thành ảnh PNG (uc4-<id>.png) bằng Microsoft Edge headless (không cần cài gì).
# Chạy từ thư mục gốc repo:  powershell -ExecutionPolicy Bypass -File docs/features/UC4-approve-leave-request/flows/render.ps1
# Máy có Playwright thì dùng render.js. Thêm sơ đồ hoặc đổi nội dung làm sơ đồ dài ra thì sửa kích thước bên dưới
# (kích thước khối .card của sơ đồ đó khi mở flows.html?static=1, đơn vị px CSS).
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
          "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'msedge.exe not found' }
$url = ([System.Uri](Join-Path $dir 'flows.html')).AbsoluteUri
$frames = [ordered]@{
  'f1' = '1000,1096'; 'f2' = '1000,751'; 'f3' = '1000,946'; 'f4' = '1000,676'; 'f5' = '1000,711'
  'f6' = '1017,673'; 'f7' = '1000,841'; 'g1' = '1200,582'; 'g2' = '1120,562'
}
$only = $args
$profile = Join-Path $env:TEMP ('hrh-flows-' + [guid]::NewGuid())
foreach ($id in $frames.Keys) {
  if ($only.Count -and -not ($only -contains $id)) { continue }
  $out = Join-Path $dir "uc4-$id.png"
  if (Test-Path $out) { Remove-Item $out }
  & $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 "--user-data-dir=$profile" `
    "--window-size=$($frames[$id])" "--screenshot=$out" "$url`?static=1#$id" | Out-Null
  Start-Sleep -Milliseconds 300
  if (-not (Test-Path $out)) { throw "Could not create $out" }
  Write-Host "uc4-$id.png"
}
Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
