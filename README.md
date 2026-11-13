# kb-portable — 一个 .duckdb 文件 = 一个知识库

便携知识库:真实中文语料(100 段 CMRC 2018)收敛进 **一个 .duckdb 文件**,用 **duckdb-web(WASM,零服务端)** 在浏览器里直接开。三层:

1. **静态链**(零模型):16 维词频向量种子 / 实体共现图 / Leiden 离线社区 / 证据回溯
2. **JEV 精排**(查询期 LLM,可选):n-gram 词法召回 → 逐段判"必需证据" 0/1 → 区分干扰段
3. **带引文回答**(查询期 LLM,可选):判 1 证据段 → 回答模型生成 `[doc_id]` 引用

## 在线演示

**https://alitrack.github.io/kb-portable/** — 纯 GitHub Pages(零服务端):打开 → 点「演示: 直接载入 /kb.duckdb」→ 点「① 静态查询链」(16 维自适应)。回答层(②)填任意 OpenAI 兼容端点 + key 后直连可用(实测 CORS 回显 Origin);未配置则如实降级纯静态链。

## 数据源模型

```
kb.duckdb (1.x 格式, 双向可读: duckdb-web wasm 1.x  +  桌面 duckdb 2.0)
├── chunks   (id, doc_id, text, embedding FLOAT[16])   ← jieba 词频向量(16维)
├── nodes    (id, entity, entity_type, degree, community) ← Leiden 离线社区(10 社区 + 64 孤点)
├── edges    (source_id, target_id, relation, weight, chunk_ids[]) ← 实体共现图(26 边)
└── meta     (key, value)                             ← 包自描述(格式/层/来源)
```

**版本边界(关键)**:duckdb-web 的 wasm 引擎是 **1.x 线**(浏览器自报 v1.5.4),读不了 2.0-alpha 写的文件。本包用 **1.4.4 引擎写**——同一文件,浏览器 wasm 与桌面 2.0 都能开。

## 查询链

**静态(浏览器内,纯 SQL,零模型):**
1. **向量种子**:16 维 jieba 词频 TF,L2 暴力距离(wasm 1.x 无 vss)
2. **图游走**:实体共现边 `A -co-occurrence→ B`
3. **社区**:Leiden 离线标签(桌面 `ml_leiden` 算好写入,查询期零模型;模块度 0.86)
4. **证据回溯**:边 → `chunk_ids` → 原文段
5. **meta**:包的自描述

**动态(查询期 LLM,可选,带引文):**
- **召回**:问题抽 2-4 字 CJK n-gram(去停用)→ 全文命中计数排序(零模型,100 段规模够用)
- **JEV 精排**:逐候选判"是否必需证据" 0/1(8 次判分,把 6 个干扰段判掉)
- **回答**:判 1 证据段喂回答模型 → 生成 `[doc_id]` 引用(实测 Q6/Q9/Q01 全命中证据,算术也正确)
- 依赖 OpenAI 兼容端点(在线配置 / 同源 `/jev` 代理);thinking 模型自动注入 `enable_thinking:false`;不可达自动降级

## 实测(数据说话)

- **23 题 R@5**(100 段真实语料, tantivy+jieba BM25 基线 vs JEV 动态层):单跳 20 题 BM25=JEV=1.000;多跳 3 题两者 0.667
- **JEV 区分力**:Q6 召回 8 候选,JEV 精确判 60/85=1,6 个干扰段=0
- **回答层**:浏览器端到端(召回→JEV→回答)14.8s,带引文准确
- **多跳边界**:题面揉两段各自实体时,AND 回退要求单段同时含两词 → 天然 miss(JEV 也救不回),这是 SAG2 词法范式的真实边界,非实现缺陷

## 运行

### 浏览器 / GitHub Pages(静态链)
直接打开 Pages URL。数据源 = 同目录 `kb.duckdb`,引擎 = 本地 `duckdb-wasm/`(mvp wasm 39MB + 自包含 bundle,esbuild 打包零 bare import)。

### 本机完整两层
```bash
cd local
JUDGE_HOST=<sglang-ip> JUDGE_PORT=8014 node serve.mjs   # 起 :8210(含 /jev 代理)
# 浏览器开 http://127.0.0.1:8210/
```

## 复现/重建

- 语料:CMRC 2018(hfl/cmrc2018)100 段, `build_corpus_tables.py` 出 chunks/nodes/edges/meta TSV
- 社区:2.0 native + 自编译 `ml_leiden`(`leiden_100.js`),写回 nodes.tsv
- 落盘:`build_kb_100.js` 用 `duckdb@1.4.4`(npm)把 TSV COPY 进 1.x 格式 .duckdb
- 1.4.4 读不了 2.0 文件,2.0 能读 1.x(单向兼容)

## 内容边界

语料是 **CMRC 2018 真实中文段落**(100 段,研究数据集),embedding 是 16 维 jieba 词频 TF(非语义向量——词法检索下足够,见"实测")。向量种子通道对低频专名问题区分度有限(8/10 问题向量稀疏),真实召回靠 n-gram 词法。
