// 驱动线上 GitHub Pages 页面: 验证引擎实例化 + 静态五查在纯静态托管下全通
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox','--disable-gpu','--window-size=1280,900'],
});
const page = await b.newPage();
page.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
page.on('pageerror', e => console.log('PE', e.message.slice(0, 200)));
page.on('console', c => { if (c.type() === 'error') console.log('ERR', c.text().slice(0, 120)); });
await page.goto('https://alitrack.github.io/kb-portable/', { waitUntil: 'networkidle2', timeout: 90000 });
// 引擎实例化(拉 40MB wasm)
await page.waitForFunction('document.getElementById("out").textContent.includes("引擎实例化完成")', { timeout: 90000 });
console.log('ENGINE: 实例化完成(线上)');
// 自动加载 kb.duckdb(若页面无自动, 点 load)
await page.click('#autoload');
await page.waitForFunction('document.getElementById("out").textContent.includes("已载入")', { timeout: 90000 });
console.log('LOAD: /kb.duckdb 载入(线上)');
await page.click('#go');
await page.waitForFunction('document.getElementById("out").textContent.includes("静态链完成")', { timeout: 30000 });
const out = await page.$eval('#out', el => el.textContent);
console.log('=== 线上输出 ===');
console.log(out.slice(0, 700));
await b.close();
