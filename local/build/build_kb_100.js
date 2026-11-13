// 100 段真实 CMRC 语料 → kb.duckdb (1.4.4 引擎写, 1.x 格式, wasm+2.0 双向可读)
// 读 data/*.tsv: 用 CTE 先把 JSON 数组列(regexp_replace 去括号 + string_to_array)转成数组,
// 再 unnest(arr) x + x.unnest::FLOAT 展开(1.4.4 的 unnest 返回 struct, 用 .unnest 字段访问)。
const duckdb = require('duckdb');
const fs = require('fs');
const DB = '/Users/sa/ws/kb-portable/kb.duckdb';
const D = '/Users/sa/ws/kb-portable/data';
fs.existsSync(DB) && fs.unlinkSync(DB);
const db = new duckdb.Database(DB, (err) => {
  if (err) { console.log('OPEN ERR', err.message); process.exit(1); }
  const run = (sql) => new Promise((res, rej) => db.run(sql, (e) => e ? rej(e) : res()));
  const all = (sql) => new Promise((res, rej) => db.all(sql, (e, r) => e ? rej(e) : res(r)));
  (async () => {
    await run(`
      CREATE TABLE chunks(id VARCHAR PRIMARY KEY, doc_id VARCHAR, text VARCHAR, embedding FLOAT[]);
      CREATE TABLE nodes(id VARCHAR PRIMARY KEY, entity VARCHAR, entity_type VARCHAR, degree INTEGER, community INTEGER);
      CREATE TABLE edges(source_id VARCHAR, target_id VARCHAR, relation VARCHAR, weight DOUBLE, chunk_ids VARCHAR[]);
      CREATE TABLE meta(key VARCHAR PRIMARY KEY, value VARCHAR);
    `);

    // chunks: text 用默认 quote 剥两端引号(CMRC 某些段以 " 开头); embedding JSON 数组 -> FLOAT[]
    await run(`
      WITH base AS (
        SELECT "id"::VARCHAR id, "doc_id"::VARCHAR doc_id, "text"::VARCHAR txt,
               string_to_array(regexp_replace(embedding, '[\\[\\]]', '', 'g'), ',') AS arr
        FROM read_csv('${D}/chunks.tsv', delim='\\t', header=true)
      )
      INSERT INTO chunks(id, doc_id, text, embedding)
      SELECT id, doc_id, txt, (SELECT list(trim(x.unnest)::FLOAT) FROM unnest(arr) x) FROM base;
    `);

    await run(`
      INSERT INTO nodes(id, entity, entity_type, degree, community)
      SELECT "id"::VARCHAR, "entity"::VARCHAR, "entity_type"::VARCHAR, "degree"::INTEGER, "community"::INTEGER
      FROM read_csv('${D}/nodes.tsv', delim='\\t', header=true);
    `);

    await run(`
      WITH base AS (
        SELECT "source_id"::VARCHAR source_id, "target_id"::VARCHAR target_id,
               "relation"::VARCHAR relation, "weight"::DOUBLE weight,
               string_to_array(regexp_replace(chunk_ids, '[\\[\\]]', '', 'g'), ',') AS arr
        FROM read_csv('${D}/edges.tsv', delim='\\t', header=true)
      )
      INSERT INTO edges(source_id, target_id, relation, weight, chunk_ids)
      SELECT source_id, target_id, relation, weight,
             (SELECT list(trim(x.unnest, '[]" ')::VARCHAR) FROM unnest(arr) x) FROM base;
    `);

    await run(`
      INSERT INTO meta(key, value)
      SELECT "key"::VARCHAR, "value"::VARCHAR
      FROM read_csv('${D}/meta.tsv', delim='\\t', header=true);
    `);

    for (const t of ['chunks', 'nodes', 'edges', 'meta']) {
      const n = await all(`SELECT count(*) AS n FROM ${t}`);
      console.log(`1.4.4 wrote ${t}: ${Number(n[0].n)} rows`);
    }
    const s = await all(`SELECT id, length(text) FROM chunks ORDER BY id::INT LIMIT 3`);
    console.log('chunks 样本:', s.map(r => `${r[0]}(${r[1]}字)`).join(' '));
    const cm = await all(`SELECT community, count(*) FROM nodes GROUP BY community ORDER BY community`);
    console.log('社区分布:', cm.map(r => `${Number(r[0])}:${Number(r[1])}`).join(' '));
    // embedding 长度核对
    const em = await all(`SELECT id, array_length(embedding) FROM chunks LIMIT 1`);
    console.log('embedding 维度:', em[0][1]);
    db.close();
    console.log('REBUILD OK ->', DB);
  })().catch(e => { console.log('BUILD FAIL', e.message); process.exit(1); });
});
