// 验证浏览器端(无 jieba/tantivy)纯 SQL 中文召回: 从问题抽 2-4 字 n-gram, LIKE 搜 chunks,
// 看 gold 段是否进 top-K。这是 JEV 精排 + 回答层的前置条件。
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

const R = await page.evaluate(async () => {
  const out = {};
  const c2 = await window.__db.connect();
  // 读全部 chunks 到内存, 在 JS 里做中文 n-gram 召回(比 SQL LIKE 更贴近 jieba 的分词召回)
  const t = await c2.query("SELECT id, text FROM chunks");
  const names = t.schema.names;
  const rows = [];
  for (let i = 0; i < t.numRows; i++) {
    rows.push([String(t.getChildAt(0).get(i)), String(t.getChildAt(1).get(i))]);
  }
  const STOP = new Set(['的','了','是','在','和','与','及','或','等','有','为','被','把','从','到','年','月','日','一个','这','那','也','都','很','可以','于','上','下','面','中','内','人','个','位','次','件','名','其','该','本','此','之','不','无','但','而','则','以','用','由','向','对','让','使','给','什么','怎么','如何','多少','哪','谁','为什么','他','她','它','我','你','您','们','同','跟','将','就','才','还','又','再','更','最']);
  function grams(text) {
    // 抽 2-4 字 CJK 片段
    const cjk = text.replace(/[^\u4e00-\u9fff]/g, ' ');
    const toks = cjk.split(/\s+/).filter(x => x.length >= 2);
    const set = new Set();
    for (const tk of toks) {
      for (let n = 2; n <= Math.min(4, tk.length); n++) {
        for (let i = 0; i + n <= tk.length; i++) set.add(tk.slice(i, i + n));
      }
    }
    return [...set].filter(g => g.length >= 2 && !STOP.has(g));
  }
  function recall(question, topK = 8) {
    const gs = grams(question);
    const scored = rows.map(([id, text]) => {
      let hit = 0;
      for (const g of gs) if (text.includes(g)) hit++;
      return { id, hit, text: text.slice(0, 30) };
    }).filter(r => r.hit > 0).sort((a, b) => b.hit - a.hit).slice(0, topK);
    return { grams: gs.length, top: scored };
  }
  for (const [q, gold, label] of [
    ['2008年北京奥运会中国田径队和中国摔跤队的领队分别是谁?', [60, 85], 'Q6'],
    ['1871年,阿道夫·恩格勒成为什么管理员?', [1], 'Q01'],
    ['田径队男子400米栏运动员是谁?摔跤队60公斤级获第4的是谁?', [60, 85], 'Q2'],
  ]) {
    const r = recall(q);
    const hit = gold.filter(g => r.top.some(x => x.id === String(g)));
    out[label] = { gold, top: r.top.map(x => `${x.id}(${x.hit})`), hit, grams: r.grams };
  }
  return out;
});
for (const [k, v] of Object.entries(R)) {
  const ok = v.hit.length === v.gold.length;
  console.log(`\n${k} ${ok ? '✓' : '✗'}  gold=${JSON.stringify(v.gold)} 召回命中=${JSON.stringify(v.hit)}`);
  console.log(`  top: ${v.top.join('  ')}`);
}
await b.close();
