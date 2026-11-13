import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox','--disable-gpu'],
});
const page = await b.newPage();
page.on('pageerror', e => console.log('PE', e.message.slice(0,200)));
await page.goto('http://127.0.0.1:8210/', { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForFunction('document.getElementById("out").textContent.includes("引擎实例化完成")', { timeout: 90000 });
await page.click('#autoload');
await page.waitForFunction('document.getElementById("out").textContent.includes("已载入")', { timeout: 90000 });
console.log('载入:', await page.$eval('#out', el => el.textContent.match(/已载入[^\n]*/)?.[0]));
const probe = await page.evaluate(() => new Promise(async (res, rej) => {
  try {
    const r = await fetch('kb.duckdb');
    const buf = await r.arrayBuffer();
    await window.__db.registerFileBuffer('/probe.duckdb', new Uint8Array(buf));
    await window.__db.open({ path: '/probe.duckdb' });
    const c2 = await window.__db.connect();
    const t1 = await c2.query("SELECT array_length(embedding) dim, count(*) n FROM chunks GROUP BY 1");
    const dim = t1.getChildAt(0).get(0), n = t1.getChildAt(1).get(0);
    const t2 = await c2.query(`SELECT (SELECT sum((v[i]-c.embedding[i])*(v[i]-c.embedding[i])) FROM unnest(range(0,16)) t(i)) FROM (SELECT [1.0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.5]::FLOAT[16] v) q, chunks c WHERE c.id='60' LIMIT 1`);
    const d = Number(t2.getChildAt(0).get(0));
    res({ dim: Number(dim), n: Number(n), l2probe: d });
  } catch (e) { rej(e); }
}));
console.log('1.33 wasm 探针:', JSON.stringify(probe));
await b.close();
