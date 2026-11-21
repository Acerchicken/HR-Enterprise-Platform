// Bản cho máy có Playwright; trên Windows dùng render.ps1. Xuất mỗi khung trong mockups.html thành một ảnh PNG
// vào thư mục mockups/ của UC chứa màn hình đó (xem outPath).
// Cần Playwright: npm i -D playwright && npx playwright install chromium (một lần).
// Chạy: node docs/features/mockups/render.js            (mọi khung)
//       node docs/features/mockups/render.js uc3-new   (chỉ các khung kể tên)
const path = require('path');
const { chromium } = require('playwright');
// Ảnh của màn hình chung (trang chủ, tìm kiếm, xem nhanh, Việc cần duyệt) nằm ở thư mục này;
// ảnh riêng của từng UC nằm ở docs/features/UCn-*/mockups/.
const UC = { 2: 'UC2-organization', 3: 'UC3-create-leave-request', 4: 'UC4-approve-leave-request',
  5: 'UC5-document-repository', 56: 'UC5-document-repository', 6: 'UC6-self-service-search', 7: 'UC7-audit-log',
  8: 'UC8-authentication' };
function outPath(id) {
  const m = /^uc(\d+)-/.exec(id);
  const uc = /^(profile-|subpage-)/.test(id) ? 'UC1-employee-profile' : m ? UC[m[1]] : null;
  return uc ? path.join(__dirname, '..', uc, 'mockups', id + '.png') : path.join(__dirname, id + '.png');
}
const ids = ['home', 'home-hr', 'search', 'quickview', 'profile-desktop', 'profile-mobile',
  'subpage-mobile', 'profile-directory-view', 'approvals',
  // UC2 → UC7
  'uc2-directory', 'uc2-org', 'uc2-dept-edit', 'uc2-transfer', 'uc2-transfer-reports', 'uc2-terminate', 'uc2-deactivate',
  'uc2-positions', 'uc2-org-mobile', 'uc2-career-mobile', 'uc3-new',
  'uc3-new-mobile', 'uc3-list', 'uc3-detail-mobile', 'uc4-manager',
  'uc4-hr', 'uc4-complete', 'uc4-delegation', 'uc4-mobile',
  'uc3-cancel-request', 'uc3-event-mobile', 'uc3-balances', 'uc4-cancel-request', 'uc4-holidays',
  'uc56-documents', 'uc6-search', 'uc6-assistant', 'uc5-detail',
  'uc5-manage', 'uc5-upload', 'uc56-mobile', 'uc7-audit',
  // UC8
  'uc8-account', 'uc8-roles', 'uc8-session', 'uc8-login-error'];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1340, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'mockups.html'));
  const only = process.argv.slice(2);
  for (const id of (only.length ? only : ids)) {
    await page.locator('div#' + id).screenshot({ path: outPath(id) });
  }
  await browser.close();
})();
