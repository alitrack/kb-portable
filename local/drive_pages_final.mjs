// 真线上(GitHub Pages)验收: 100段版静态链(16维自适应)+ JEV 未配置时如实降级
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox','--disable-gpu','--window-size=1280,1000'],
});
const page = await b.newPage();
let fail = 0;
page.on('pageerror', e => { console.log('PE', e.message.slice(0,200)); fail++; });
page.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().split('/').pop()); });
await page.goto('https://alitrack.github.io/kb-portable/', { waitUntil: 'networkidle2', timeout: 120000 });
await page.waitForFunction('document.getElementById("out").textContent.includes("引擎实例化完成")', { timeout: 120000 });
console.log('引擎:', await page.$eval('#ver', el => el.textContent));
// 页面自带 autoload
await page.waitForFunction('document.getElementById("out").textContent.includes("已载入")', { timeout: 120000 });
const load = await page.$eval('#out', el => el.textContent.match(/已载入[^\n]*/)?.[0]);
console.log(load);
if (!/100|2060 KB/.test(load)) { console.log('⚠ 载入信息异常'); fail++; }
// 静态链
await page.click('#go');
await page.waitForFunction('document.getElementById("out").textContent.includes("静态链完成") || document.getElementById("out").textContent.includes("静态链 FAIL")', { timeout: 30000 });
const out = await page.$eval('#out', el => el.textContent);
console.log('\n=== 线上静态链(100段, 16维自适应) ===\n' + out);
if (out.includes('FAIL') || !/100/.test(out)) fail++;
// JEV 未配置: 应如实降级(线上无 /jev 代理)
await page.click('#jevgo');
await page.waitForFunction('document.getElementById("jevout").textContent.includes("自动降级") || document.getElementById("jevout").textContent.includes("未配置")', { timeout: 15000 });
const jout = await page.$eval('#jevout', el => el.textContent);
console.log('\n=== 线上 JEV 未配置(应降级) ===\n' + jout.slice(0, 300));
if (!/降级|未配置/.test(jout)) fail++;
console.log(fail ? `\n${fail} 项异常` : '\n全部通过 ✓');
await b.close();
process.exit(fail ? 1 : 0);
