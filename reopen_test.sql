.timer on
LOAD vss;
SET hnsw_enable_experimental_persistence=true;
LOAD '/Users/sa/ws/duckdb-tantivy/build/release/tantivy.duckdb_extension';
-- 1) question -> vector seeds (HNSW persisted in the file)
SELECT '1_vec_seed' AS step, n.entity, round(array_distance(c.embedding, [0.85,0.15,0.05,0.05]::FLOAT[4]),3) AS dist
FROM chunks c JOIN nodes n ON n.id=c.id
ORDER BY array_distance(c.embedding, [0.85,0.15,0.05,0.05]::FLOAT[4]) LIMIT 2;
-- 2) BM25 full-text, v0.3.0 named persistent index (rebuild in this process)
SELECT * FROM tantivy_create_index('chunks_fts', 'chunks', text_column := 'text');
SELECT '2_bm25' AS step, c.text, s.score
FROM tantivy_search_index('chunks_fts', 'knowledge graphs retrieval', 2) s JOIN chunks c ON c.rowid = s.doc_id;
-- 3) graph walk (recursive CTE, duckdb-graphrag pattern)
SELECT '3_walk' AS step, n.entity
FROM (WITH RECURSIVE w(node_id, depth) AS (
  SELECT 'n2' AS node_id, 0::INTEGER AS depth
  UNION ALL
  SELECT e.target_id, w.depth+1 FROM w JOIN edges e ON e.source_id=w.node_id WHERE w.depth<2)
  SELECT DISTINCT node_id FROM w) w2 JOIN nodes n ON n.id=w2.node_id;
-- 4) evidence recall: walked edges -> source chunks
SELECT '4_evidence' AS step, e.relation, unnest(e.chunk_ids)
FROM edges e WHERE e.source_id IN (
  WITH RECURSIVE w(node_id, depth) AS (
    SELECT 'n2' AS node_id, 0::INTEGER AS depth
    UNION ALL
    SELECT e2.target_id, w.depth+1 FROM w JOIN edges e2 ON e2.source_id=w.node_id WHERE w.depth<2)
  SELECT node_id FROM w);
