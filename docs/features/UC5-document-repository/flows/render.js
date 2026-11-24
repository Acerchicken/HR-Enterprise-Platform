// Xuất mỗi sơ đồ trong flows.html thành một ảnh PNG trong cùng thư mục (uc5-<id>.png).
// Cần Playwright: npm i -D playwright && npx playwright install chromium (một lần).
// Chạy: node docs/features/UC5-document-repository/flows/render.js        (mọi sơ đồ)
//       node docs/features/UC5-document-repository/flows/render.js f6 g1  (chỉ các sơ đồ kể tên)
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  const url = 'file://' + path.join(__dirname, 'flows.html') + '?static=1';
  await page.goto(url);
  const all = await page.evaluate(() => window.FLOWS.map((f) => f.id));
  const only = process.argv.slice(2);
  for (const id of only.length ? only : all) {
    await page.goto(url + '#' + id);
    await page.evaluate((id) => { location.hash = id; }, id);
    await page.waitForTimeout(100);
    await page.locator('.card').screenshot({ path: path.join(__dirname, 'uc5-' + id + '.png') });
    console.log('uc5-' + id + '.png');
  }
  await browser.close();
})();
