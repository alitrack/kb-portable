// Drive 1.33 wasm page: upload .duckdb straight into the file input (no native
// picker), click load, run the query chain, dump rendered output.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const fileArg = process.argv[2];
if (!fileArg) { console.log('usage: node drive2.mjs <path>'); process.exit(2); }

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox','--disable-gpu','--window-size=1280,900'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,200)));

console.log('loading page…');
await page.goto('http://127.0.0.1:8210/', { waitUntil: 'networkidle2', timeout: 90000 });

await page.waitForFunction(() => {
  const v = document.getElementById('ver');
  return v && !v.textContent.includes('…') && v.textContent.length > 0;
}, { timeout: 60000 });
console.log('WASM ENGINE VERSION:', await page.$eval('#ver', e => e.textContent));

// Inject the file directly into <input type=file> (bypasses native picker)
const input = await page.$('#file');
await input.uploadFile(fileArg);
await page.click('#load');
await new Promise(r => setTimeout(r, 2000));
const loadLine = (await page.$eval('#out', e => e.innerText)).split('\n').find(l => l.includes('已载入') || l.includes('OPEN FAIL'));
console.log('LOAD RESULT:', loadLine || '(none)');

await page.click('#go');
await new Promise(r => setTimeout(r, 3500));

const rendered = await page.$eval('#out', e => e.innerText);
console.log('========== RENDERED QUERY CHAIN ==========');
console.log(rendered);
fs.writeFileSync('/tmp/kbweb2_dom.html', await page.content());
await browser.close();
