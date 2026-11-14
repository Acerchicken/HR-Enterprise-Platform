# Render each frame of mockups.html to a PNG with headless Microsoft Edge (nothing to install).
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
}
$profile = Join-Path $env:TEMP ('hrh-mock-' + [guid]::NewGuid())
foreach ($id in $frames.Keys) {
  $out = Join-Path $dir "$id.png"
  & $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 "--user-data-dir=$profile" `
    "--window-size=$($frames[$id])" "--screenshot=$out" "$url`?only=$id" | Out-Null
  Start-Sleep -Milliseconds 300
  if (-not (Test-Path $out)) { throw "Could not create $out" }
  Write-Host "$id.png"
}
Remove-Item -Recurse -Force $profile -ErrorAction SilentlyContinue
