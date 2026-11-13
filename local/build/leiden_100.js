// 2.0 native + ml 扩展(Leiden)给 100 节点图算社区, 覆写 data/nodes.tsv 第5列(community)
const duckdb = require('duckdb');
const fs = require('fs');
const DB = '/tmp/kb1x/leiden20.duckdb';
fs.existsSync(DB) && fs.unlinkSync(DB);

const db = new duckdb.Database(DB, { allow_unsigned_extensions: 'true' }, (err) => {
  if (err) { console.log('OPEN ERR', err.message); process.exit(1); }
  const run = (sql) => new Promise((res, rej) => db.run(sql, (e) => e ? rej(e) : res()));
  const all = (sql) => new Promise((res, rej) => db.all(sql, (e, r) => e ? rej(e) : res(r)));
  (async () => {
    await run("LOAD '/Users/sa/ws/duckdb-ml/build/release/ml.duckdb_extension'");
    // edges.tsv: source_id target_id relation weight chunk_ids(JSON)
    // 只取前3列(源/目标/权重)做图; 强制 VARCHAR 防 BIGINT 推断
    await run("CREATE TABLE edges AS SELECT " +
      "CAST(\"source_id\" AS VARCHAR) src, CAST(\"target_id\" AS VARCHAR) dst, CAST(\"weight\" AS DOUBLE) w " +
      "FROM read_csv('/Users/sa/ws/kb-portable/data/edges.tsv', delim='\\t', header=true)");
    const n = await all("SELECT count(*) c FROM edges");
    console.log('edges:', Number(n[0].c));
    // 列名是 src/dst/w(CTAS 定义), 不是 s/t/w — 之前 r.s/r.t 是 undefined 导致全节点坍缩成 1 社区
    const rows = await all("SELECT src, dst, w FROM edges");
    const j = JSON.stringify(rows.map(r => ({ s: String(r.src), t: String(r.dst), w: Number(r.w) })));
    const out = await all(`SELECT ml_leiden('${j.replace(/'/g, "''")}'::JSON) AS r`);
    const leiden = JSON.parse(out[0].r);
    console.log('社区数:', leiden.community, ' modularity:', leiden.modularity, ' levels:', leiden.levels);
    const cmap = {};
    for (const nd of leiden.nodes) cmap[nd.node] = nd.community;

    // 覆写 nodes.tsv 第5列(community): 按行 split tab, 替换第5字段
    const NODES = '/Users/sa/ws/kb-portable/data/nodes.tsv';
    const lines = fs.readFileSync(NODES, 'utf8').trim().split('\n');
    const outLines = lines.map((l, i) => {
      if (i === 0) return l; // header 不动
      const parts = l.split('\t');
      const id = parts[0];
      // 图内节点 -> Leiden 社区;孤立节点(不在任何边端点)保持 build 的 -1(未入图)
      parts[4] = String(cmap[id] ?? -1); // community 是第5列(index 4)
      return parts.join('\t');
    });
    fs.writeFileSync(NODES, outLines.join('\n') + '\n');
    const dist = {};
    for (const c of Object.values(cmap)) dist[c] = (dist[c] || 0) + 1;
    console.log('社区分布:', JSON.stringify(dist));
    db.close();
    console.log('LEIDEN DONE (nodes.tsv 第5列已覆写)');
  })().catch(e => { console.log('FAIL', e.message); process.exit(1); });
});
