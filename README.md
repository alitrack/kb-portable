# kb-portable — 一个 .duckdb 文件 = 一个知识库

便携知识库 PoC:静态三通道(向量/实体-关系图/Leiden 社区)+ 可选 SAG2/JEV 查询期动态层,全部收敛进 **一个 .duckdb 文件**,用 **duckdb-web(WASM,零服务端)** 在浏览器里直接开。

## 在线演示

**https://alitrack.github.io/kb-portable/** — 纯 GitHub Pages(零服务端):打开 → 点「演示: 直接载入 /kb.duckdb」→ 点「① 静态查询链」。40MB wasm 首次加载约几秒(视网速),之后五查 ~120ms。JEV 按钮在非 localhost 部署会提示自动降级(内网 sglang 公网不可达,设计内)。

## 数据源模型

```
kb.duckdb (1.x 格式, 双向可读: duckdb-web wasm 1.x  +  桌面 duckdb 2.0)
├── chunks   (id, doc_id, text, embedding FLOAT[])   ← 向量种子
├── nodes    (id, entity, entity_type, degree, community) ← Leiden 离线社区标签
├── edges    (source_id, target_id, relation, weight, chunk_ids[]) ← 图游走 + 证据回溯
└── meta     (key, value)                             ← 包自描述(格式/层/重建时间)
```

**版本边界(关键)**:duckdb-web 的 wasm 引擎是 **1.x 线**(浏览器自报 v1.5.4),读不了 2.0-alpha 写的文件(`version number 999 > max 64`)。所以本包用 **1.4.4 引擎写**——同一文件,浏览器 wasm 与桌面 2.0 都能开。

## 查询链(浏览器内,全部纯 SQL,零模型)

1. **向量种子**:纯 SQL L2 暴力距离(wasm 1.x 无 vss;toy 规模与 HNSW 等价,生产规模 HNSW 留桌面端)
2. **图游走**:实体-关系边 `A -relation→ B`,CTE bounded walk
3. **社区**:Leiden 离线标签(桌面端 `ml_leiden` 计算后写入,查询期零模型)
4. **证据回溯**:节点 → `chunk_ids` → 原文段
5. **meta**:包的自描述

## 可选动态层:JEV(SAG2,查询期 LLM 裁判)

- 浏览器端 ~200 行 JS:种子判分(必需证据 0/1)→ TF-IDF 式扩展词 → 词法二跳 → 终排
- **依赖一个同源 `/jev` 代理**(`serve.mjs` 提供):转发到内网 sglang 端点,自动注入 thinking 模型适配(顶层 `chat_template_kwargs:{enable_thinking:false}`)
- **降级是设计内的**:端点不可达(Pages 上必然)→ 自动回纯静态链,页面如实标 `degraded`
- sag2zh 参考实现(10 题 R@5 0.533→0.867 那套)在 `alitrack/sag2zh`,本仓库不依赖它

## 运行

### 浏览器 / GitHub Pages(静态五查)
直接打开 Pages URL(或本仓库 `web/data/index.html`)。数据源 = 同目录 `../kb.duckdb`,引擎 = 本地 `duckdb-wasm/`(mvp wasm 39MB + 自包含 bundle,esbuild 打包零 bare import)。JEV 按钮会显示降级。

### 本机完整两层
```bash
cd web && npm install esbuild        # 仅打包时需要
node launcher.mjs                     # 起 :8210(含 /jev 代理)
# 浏览器开 http://127.0.0.1:8210/
```
JEV 裁判端点走 `JUDGE_HOST` / `JUDGE_PORT` 环境变量(默认 `127.0.0.1:8014`,见 `web/serve.mjs`);内网 sglang 实例自己 export,值不入库。

## 复现/重建

- 图生成公式(600 节点验证图,PoC-②):`gen_graph.sql`
- 600 节点 Leiden 社区对齐 leidenalg(Q=0.926):`kb-portable` 上游 `duckdb-ml/src/leiden.rs`
- 本 toy 包由 parquet 经 `duckdb@1.4.4`(npm)重写;1.4.4 读不了 2.0 文件,2.0 能读 1.x

## 内容边界

语料是 **4 段 toy 英文 chunk + 4 实体图**(GraphRAG/LightRAG/DuckDB/Tantivy),用于演示架构闭环,非真实知识库。放大规模 = 同一管道换数据源(导出 parquet → 1.4.4 重写),见 HTML 报告 §7。
