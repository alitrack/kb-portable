// Full drive: autoload /kb.duckdb, run static chain, run JEV layer, dump both.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox','--disable-gpu','--window-size=1280,900'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,200)));
page.on('console', m => { const t = m.text(); if (m.type() === 'error') console.log('CONSOLE:', t.slice(0,160)); });

console.log('loading…');
await page.goto('http://127.0.0.1:8210/', { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForFunction(() => {
  const v = document.getElementById('ver');
  return v && !v.textContent.includes('…') && v.textContent.length > 0;
}, { timeout: 60000 });
console.log('ENGINE:', await page.$eval('#ver', e => e.textContent));

// autoload runs on page load; wait for it
await new Promise(r => setTimeout(r, 3000));

// ① static
await page.click('#go');
await new Promise(r => setTimeout(r, 3000));
console.log('===== ① STATIC =====');
console.log((await page.$eval('#out', e => e.innerText)).slice(0, 1400));

// ② JEV
await page.click('#jevgo');
await new Promise(r => setTimeout(r, 12000));
console.log('===== ② JEV =====');
console.log((await page.$eval('#jevout', e => e.innerText)).slice(0, 1600));

fs.writeFileSync('/tmp/kbweb_full.html', await page.content());
await browser.close();
