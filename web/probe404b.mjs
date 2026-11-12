import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--allow-file-access',
    '--enable-features=WebContentWorlds', '--disable-features=IsolateOrigins,site-per-process'],
});
const page = await b.newPage();
page.on('response', r => { if (r.status() >= 400) console.log('404?', r.status(), r.url()); });
page.on('requestfailed', r => console.log('FAIL', r.failure()?.errorText, r.url()));
page.on('console', c => console.log('C', c.type(), c.text()));
page.on('pageerror', e => console.log('PE', e.message));
await page.goto('http://127.0.0.1:8210/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 12000));
const out = await page.$eval('#out', el => el.textContent).catch(() => '(no #out)');
console.log('OUT:', out.slice(0, 200));
await b.close();