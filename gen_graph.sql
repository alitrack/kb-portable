-- Deterministic planted-partition graph: 6 communities x 100 nodes.
-- 10k intra-community + 2k inter-community directed edges (fixed formula, no RNG).
-- Run:  duckdb -unsigned poctest.duckdb < gen_graph.sql
-- Export: duckdb -unsigned poctest.duckdb -csv -noheader -c "COPY edges TO 'edges.csv' (HEADER)"
CREATE TABLE nodes(id VARCHAR PRIMARY KEY, community INTEGER);
CREATE TABLE edges(source_id VARCHAR, target_id VARCHAR, weight DOUBLE);

INSERT INTO nodes SELECT ('n' || lpad(i::VARCHAR,3,'0')), (i/100) FROM range(600) t(i);

-- intra: 10k directed, source in community c, target another node in SAME community (same bucket, different node)
INSERT INTO edges SELECT
  'n' || lpad((i % 600)::VARCHAR,3,'0'),
  'n' || lpad(((i*37 + 1) % 600)::VARCHAR,3,'0'),
  1.0
FROM range(10000) t(i)
WHERE (i % 600) / 100 = ((i*37 + 1) % 600) / 100
  AND (i % 600) <> ((i*37 + 1) % 600);

-- inter: 2k directed, target in a DIFFERENT community
INSERT INTO edges SELECT
  'n' || lpad((i % 600)::VARCHAR,3,'0'),
  'n' || lpad(((i*37 + 1) % 600)::VARCHAR,3,'0'),
  1.0
FROM range(2000) t(i)
WHERE (i % 600) / 100 <> ((i*37 + 1) % 600) / 100
  AND (i % 600) <> ((i*37 + 1) % 600);
