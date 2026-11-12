-- load.sql: 打开一个便携知识库包 (本目录). 用法:
--   duckdb -unsigned kb_final.duckdb < load.sql
-- 之后: 提问 -> 向量种子 -> 图游走 -> BM25 -> 证据 chunk
LOAD 'tantivy.duckdb_extension路径' ;   -- 本机: /Users/sa/ws/duckdb-tantivy/build/release/tantivy.duckdb_extension
LOAD vss;
SET hnsw_enable_experimental_persistence=true;
-- BM25: 从包内 .tantivy_index/ 目录读回(只读, 免重建)
SELECT * FROM tantivy_load_index('chunks_fts', path := '.tantivy_index/chunks_fts');
-- ============ 提问(替换 q 为问题向量, FLOAT[1024] 对 bge-m3) ============
-- ① 向量种子
-- SELECT c.id, c.text FROM chunks c
--  ORDER BY array_distance(c.embedding, CAST('q' AS FLOAT[4])) LIMIT 5;
-- ② 图游走(bounded, 稠密图必须带 depth 上限)
-- WITH RECURSIVE w(node_id, depth) AS (
--   SELECT 'n2' AS node_id, 0::INTEGER AS depth
--   UNION ALL
--   SELECT e.target_id, w.depth+1 FROM w JOIN edges e ON e.source_id=w.node_id WHERE w.depth<2)
-- SELECT DISTINCT n.entity FROM w JOIN nodes n ON n.id=w.node_id;
-- ③ 证据回溯
-- SELECT DISTINCT unnest(e.chunk_ids) FROM edges e WHERE e.source_id IN (SELECT node_id FROM w);
-- ④ BM25
-- SELECT c.text, s.score FROM tantivy_search_index('chunks_fts', 'query text', top_k := 5) s
--   JOIN chunks c ON c.rowid = s.doc_id;
