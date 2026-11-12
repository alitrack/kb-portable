// Drive the real duckdb-web wasm app in system Chrome and read rendered results.
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e)));

await page.goto('http://127.0.0.1:8210/', { waitUntil: 'networkidle0', timeout: 60000 });

// wait for engine version to populate (wasm instantiated)
let ver = '';
try {
  await page.waitForFunction(() => document.getElementById('ver') && document.getElementById('ver').textContent !== '…',
    { timeout: 60000 });
  ver = await page.$eval('#ver', e => e.textContent);
} catch (e) {
  ver = '(version element not set: ' + e.message + ')';
}
console.log('WASM ENGINE VERSION:', ver);

// click run
await page.click('#go');
// wait until the final "完成" marker or 8s max
try {
  await page.waitForFunction(() => {
    const t = document.getElementById('out').textContent;
    return t.includes('完成') || t.includes('社区标签');
  }, { timeout: 30000 });
} catch (e) { /* fallthrough */ }
await new Promise(r => setTimeout(r, 1500));

const result = await page.$eval('#out', e => e.innerText);
console.log('\n========== RENDERED QUERY CHAIN ==========\n' + result);

const pageHtml = await page.content();
import fs from 'node:fs';
fs.writeFileSync('/tmp/kbweb_dom.html', pageHtml);
console.log('\ndom saved: /tmp/kbweb_dom.html', pageHtml.length, 'bytes');

// console + page errors (interesting ones only)
console.log('\n========== BROWSER LOG (tail) ==========\n' + logs.slice(-25).join('\n'));

await browser.close();
