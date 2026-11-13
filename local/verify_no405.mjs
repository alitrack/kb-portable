import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const page = await b.newPage();
await page.goto('http://127.0.0.1:8210/', { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForFunction('document.getElementById("out").textContent.includes("已载入")', { timeout: 90000 });
await page.evaluate(() => localStorage.clear());
await page.click('#jevgo');
// localhost 走 /jev 代理(serve 活着)→ 应完成全链或降级
await page.waitForFunction('document.getElementById("jevout").textContent.includes("带引文回答") || document.getElementById("jevout").textContent.includes("DEGRADED")', { timeout: 90000 });
const t = await page.$eval('#jevout', el => el.textContent);
console.log(t.slice(0, 400));
await b.close();
