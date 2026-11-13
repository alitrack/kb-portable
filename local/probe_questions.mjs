// 问题候选实测: 对每个候选问题跑完整 JEV 链(静态种子→判分→扩展二跳→终排), 记录效果
import puppeteer from 'puppeteer-core';

const QUESTIONS = [
  'GraphRAG 是怎么改进检索的?',
  'LightRAG 和 GraphRAG 是什么关系?',
  'LightRAG 跑在什么数据库上, 那个数据库又扩展了什么?',
  'Tantivy 在 DuckDB 里提供什么能力?',
];

const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox','--disable-gpu','--window-size=1280,1000'],
});
const page = await b.newPage();
page.on('pageerror', e => console.log('PE', e.message.slice(0,150)));
await page.goto('http://127.0.0.1:8210/', { waitUntil: 'networkidle2' });
await page.waitForFunction('document.getElementById("out").textContent.includes("引擎实例化完成")', { timeout: 90000 });
await page.click('#autoload');
await page.waitForFunction('document.getElementById("out").textContent.includes("已载入")', { timeout: 60000 });
// JEV 端点: 本地 /jev 代理(留空)
await page.evaluate(() => {
  const u = document.getElementById('jevurl'); u.value = ''; u.dispatchEvent(new Event('change'));
  const m = document.getElementById('jevmodel'); m.value = 'qwen3.8-27b'; m.dispatchEvent(new Event('change'));
});

for (const q of QUESTIONS) {
  await page.evaluate((qq) => {
    document.getElementById('question').value = qq;
  }, q);
  await page.click('#jevgo');
  // 等 JEV 输出完成(出现"调用 N 次"或 DEGRADED)
  await page.waitForFunction(
    'document.getElementById("jevout").textContent.includes("调用") || document.getElementById("jevout").textContent.includes("DEGRADED")',
    { timeout: 90000 });
  await new Promise(r => setTimeout(r, 500));
  const out = await page.$eval('#jevout', el => el.textContent);
  console.log('\n======== Q: ' + q + ' ========');
  console.log(out);
}
await b.close();
