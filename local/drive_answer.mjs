// 端到端: 载入 100 段 kb.duckdb -> 静态链(16维自适应) -> JEV 回答层(8014 直连, 带引文)
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox','--disable-gpu','--window-size=1280,1000'],
});
const page = await b.newPage();
page.on('pageerror', e => console.log('PE', e.message.slice(0,200)));
page.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().split('/').pop()); });
await page.goto('http://127.0.0.1:8210/', { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForFunction('document.getElementById("out").textContent.includes("引擎实例化完成")', { timeout: 90000 });
console.log('引擎:', await page.$eval('#ver', el => el.textContent));
await page.click('#autoload');
await page.waitForFunction('document.getElementById("out").textContent.includes("已载入")', { timeout: 90000 });
console.log(await page.$eval('#out', el => el.textContent.match(/已载入[^\n]*/)?.[0]));

// ① 静态链(16 维自适应)
await page.click('#go');
await page.waitForFunction('document.getElementById("out").textContent.includes("静态链完成") || document.getElementById("out").textContent.includes("静态链 FAIL")', { timeout: 30000 });
const staticOut = await page.$eval('#out', el => el.textContent);
console.log('\n=== ① 静态链 ===\n' + staticOut.slice(0, 900));

// ② JEV 回答层(8014 直连, 需 localStorage 配端点)
await page.evaluate(() => {
  localStorage.setItem('jev_url', 'http://10.10.10.115:8014/v1');
  localStorage.setItem('jev_key', 'local');
  localStorage.setItem('jev_model', 'qwen3.8-27b');
  document.getElementById('jevurl').value = 'http://10.10.10.115:8014/v1';
  document.getElementById('jevmodel').value = 'qwen3.8-27b';
});
// 设问题
await page.evaluate(() => { document.getElementById('question').value = '2008年北京奥运会中国田径队和中国摔跤队的领队分别是谁?'; });
console.log('\n=== ② JEV 回答层(8014 直连) ===');
const t0 = Date.now();
await page.click('#jevgo');
await page.waitForFunction('document.getElementById("jevout").textContent.includes("带引文回答") || document.getElementById("jevout").textContent.includes("DEGRADED") || document.getElementById("jevout").textContent.includes("证据不足")', { timeout: 90000 });
const jevOut = await page.$eval('#jevout', el => el.textContent);
console.log(jevOut);
console.log(`\n[耗时 ${((Date.now()-t0)/1000).toFixed(1)}s]`);
await b.close();
