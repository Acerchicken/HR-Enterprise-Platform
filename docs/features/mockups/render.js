// Bản cho máy có Playwright; trên Windows dùng render.ps1. Xuất mỗi khung trong mockups.html thành một ảnh PNG trong cùng thư mục.
// Cần Playwright: npm i -D playwright && npx playwright install chromium (một lần).
// Chạy: node docs/features/mockups/render.js
const path = require('path');
const { chromium } = require('playwright');
const ids = ['home', 'home-hr', 'search', 'quickview', 'profile-desktop', 'profile-mobile',
  'subpage-mobile', 'profile-directory-view', 'approvals'];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1340, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'mockups.html'));
  for (const id of ids) {
    await page.locator('div#' + id).screenshot({ path: path.join(__dirname, id + '.png') });
  }
  await browser.close();
})();
