# Render each frame of mockups.html to a PNG with headless Microsoft Edge (nothing to install).
# Shared screens go to this folder, UC screens to docs/features/UCn-*/mockups/.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File docs/features/mockups/render.ps1
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
          "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'msedge.exe not found' }
$url = ([System.Uri](Join-Path $dir 'mockups.html')).AbsoluteUri
# frame id = width,height, must match the CSS in mockups.html
$frames = [ordered]@{
  'home' = '1280,800'; 'home-hr' = '1280,560'; 'search' = '1280,620'; 'quickview' = '1280,720'
  'profile-desktop' = '1280,900'; 'profile-mobile' = '390,1745'; 'subpage-mobile' = '390,844'
  'profile-directory-view' = '390,700'; 'approvals' = '1280,760'
  # UC2 → UC7
  'uc2-directory' = '1280,740'
  'uc2-org' = '1280,800'
  'uc2-dept-edit' = '1280,760'
  'uc2-transfer' = '1280,820'
  'uc2-transfer-reports' = '1280,860'
  'uc2-terminate' = '1280,700'
  'uc2-deactivate' = '1280,600'
  'uc2-positions' = '1280,640'
  'uc2-org-mobile' = '390,844'
  'uc2-career-mobile' = '390,844'
  'uc3-new' = '1280,800'
  'uc3-new-mobile' = '390,960'
  'uc3-list' = '1280,760'
  'uc3-detail-mobile' = '390,844'
  'uc4-manager' = '1280,800'
  'uc4-hr' = '1280,800'
  'uc4-complete' = '1280,700'
  'uc4-delegation' = '1280,720'
  'uc4-mobile' = '390,844'
  'uc3-cancel-request' = '1280,760'
  'uc3-event-mobile' = '390,960'
  'uc3-balances' = '1280,780'
  'uc4-cancel-request' = '1280,860'
  'uc4-holidays' = '1280,780'
  'uc56-documents' = '1280,820'
  'uc6-search' = '1280,700'
  'uc6-assistant' = '1280,780'
  'uc5-detail' = '1280,680'
  'uc5-manage' = '1280,700'
  'uc5-upload' = '1280,800'
  'uc56-mobile' = '390,844'
  'uc7-audit' = '1280,820'
  'uc8-account' = '1280,900'
  'uc8-roles' = '1280,760'
  'uc8-session' = '640,520'
  'uc8-login-error' = '640,520'
}
# Ảnh màn hình chung ở thư mục này; ảnh riêng của từng UC ở docs/features/UCn-*/mockups/.
$ucDirs = @{ '2' = 'UC2-organization'; '3' = 'UC3-create-leave-request'; '4' = 'UC4-approve-leave-request'
  '5' = 'UC5-document-repository'; '56' = 'UC5-document-repository'; '6' = 'UC6-self-service-search'; '7' = 'UC7-audit-log'
  '8' = 'UC8-authentication' }
$profile = Join-Path $env:TEMP ('hrh-mock-' + [guid]::NewGuid())
foreach ($id in $frames.Keys) {
  $uc = $null
  if ($id -match '^(profile-|subpage-)') { $uc = 'UC1-employee-profile' }
  elseif ($id -match '^uc(\d+)-') { $uc = $ucDirs[$Matches[1]] }
  $outDir = if ($uc) { Join-Path (Split-Path -Parent $dir) "$uc\mockups" } else { $dir }
  $out = Join-Path $outDir "$id.png"
  & $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 "--user-data-dir=$profile" `
    "--window-size=$($frames[$id])" "--screenshot=$out" "$url`?only=$id" | Out-Null
  Start-Sleep -Milliseconds 300
  if (-not (Test-Path $out)) { throw "Could not create $out" }
  Write-Host "$id.png"
}
Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
