#!/usr/bin/env python3
"""CMRC 100 段 → 4 表 (chunks/nodes/edges/meta) 的 parquet。
- embedding: jieba top4 词频的 4 维 TF 向量(确定性,可复现,纯 Python 无 LLM)
- 图: 文档共享 ≥2 个实体的段落对成边(共现次数为权重)
- 社区: 由 node 端 ml_leiden 离线算(这里只出边)
写 parquet 到 data/, 1.4.4 node 端 COPY 进 .duckdb(1.x 格式)。
"""
import json, os, re, sys
from collections import Counter
import jieba

CORPUS = json.load(open('/tmp/cmrc_corpus.json', encoding='utf-8'))
OUT = '/Users/sa/ws/kb-portable/data'
os.makedirs(OUT, exist_ok=True)

STOP_WORDS = {'的','了','是','在','和','与','及','或','等','有','为','被','把','从','到','年','月','日','一个','这','那','也','都','很','可以','于','上','下','面','中','内','人','个','位','次','件','名','其','该','本','此','之','不','无','但','而','则','以','用','由','向','对','被','把','让','使','给','为','以','按','照','依','据','凭','靠','通','过','后','前','间','时','候','期','段','中','外','边','旁','侧','里','外','内','上','下'}

def tokens(text):
    return [t for t in jieba.lcut(text) if len(t) >= 2 and not t.isdigit() and t not in STOP_WORDS]

def entity_label(text):
    """干净的段标签: 剥掉前导引号/标点/书名号, 取前 ~12 个 CJK 字(无裸引号)。"""
    t = text.strip()
    # 剥前导引号/括号/书名号等
    t = t.lstrip('"“」』）)]《>＞· ')
    # 取前 12 个 CJK, 不足则保留原文前 12
    cjk = [ch for ch in t[:24] if '\u4e00' <= ch <= '\u9fff']
    label = ''.join(cjk)
    if len(label) < 6:
        label = t[:12]
    # 确保 label 不带引号(安全)
    return label.replace('"', '').replace('“', '').replace('”', '')[:14]

docs = CORPUS['docs']
n = len(docs)
print(f'{n} docs')

# --- chunks: embedding = top16 jieba 词频(确定性 TF) ---
DIM = 16
all_tokens = [t for d in docs for t in tokens(d['text'])]
vocab = [w for w, _ in Counter(all_tokens).most_common(DIM)]  # 固定 16 维词表
print('embedding 词表(top16):', vocab)
emb_of = {}
for d in docs:
    c = Counter(tokens(d['text']))
    s = sum(c[w] for w in vocab)
    emb_of[d['id']] = [round(c[w] / s, 4) if s else 0.0 for w in vocab]

chunks = [{'id': str(d['id']), 'doc_id': str(d['id']), 'text': d['text'], 'embedding': emb_of[d['id']]} for d in docs]

# --- 实体: 2-6 字中文词 + 带·专名(去停用) ---
def entities(text):
    ents = set()
    ents |= set(re.findall(r'[\u4e00-\u9fff]{2,4}·[\u4e00-\u9fff]{2,4}', text))
    ents |= set(t for t in re.findall(r'[\u4e00-\u9fff]{2,6}', text) if t not in STOP_WORDS and not t.isdigit())
    return ents

ent_by_doc = {d['id']: entities(d['text']) for d in docs}

# --- edges: 共享 ≥2 实体的文档对, 权重 = 共享数 ---
# 100 段 = 4950 对, 全量两两算
edges = []
for i in range(n):
    for j in range(i+1, n):
        a, b = docs[i]['id'], docs[j]['id']
        shared = ent_by_doc[a] & ent_by_doc[b]
        if len(shared) >= 2:
            edges.append({'source_id': str(a), 'target_id': str(b),
                          'relation': 'co-occurrence', 'weight': float(len(shared)),
                          'chunk_ids': [str(a), str(b)]})
# 去重(source<target) + 排序
edges.sort(key=lambda e: (int(e['source_id']), int(e['target_id'])))
print(f'edges: {len(edges)} (共享≥2实体文档对)')

# --- nodes: 每个文档一个节点(实体 = 干净段标签, 类型=cmrc) ---
# community 列由后续 leiden_100.js 用 ml_leiden 覆写(这里先写 -1=待分配)
nodes = [{'id': str(d['id']),
          'entity': entity_label(d['text']),
          'entity_type': 'cmrc-doc',
          'degree': sum(1 for e in edges if e['source_id']==str(d['id']) or e['target_id']==str(d['id'])),
          'community': -1}
          for d in docs]

meta = [
  {'key':'format_version','value':'1.x (duckdb 1.4.4 line)'},
  {'key':'writable_by','value':'1.33 wasm (duckdb-web browser) + 2.0 native (desktop) — 一个包到处开'},
  {'key':'layer_static','value':'chunks(词频TF embedding)/nodes(Leiden社区)/edges(共现实体图+chunk_ids证据回溯)'},
  {'key':'layer_dynamic','value':'可选 JEV(SAG2) 查询期层: 浏览器 JS, 端点不可达自动降级'},
  {'key':'origin','value':'真实语料 CMRC 2018(hfl/cmrc2018) 100 段 + jieba 词频向量 + 共现实体图'},
  {'key':'rebuilt_at','value':'2026-11-13'},
  {'key':'usage','value':'registerFileBuffer 载入即可查询; 数据本体即包'},
]

import json as _j
# TSV 直写: CMRC 文本含中文/ASCII 引号, CSV 引号包裹会被 duckdb/reader 反复拆行。
# tab 分隔 + 字段内 tab/换行替换 = 最稳。
def write_tsv(path, rows, cols):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        f.write('\t'.join(cols) + '\n')
        for r in rows:
            vals = []
            for k in cols:
                v = r.get(k)
                if isinstance(v, list):
                    v = _j.dumps(v, ensure_ascii=False)
                v = str(v).replace('\t', ' ').replace('\n', ' ')
                vals.append(v)
            f.write('\t'.join(vals) + '\n')

write_tsv(f'{OUT}/chunks.tsv', chunks, ['id','doc_id','text','embedding'])
write_tsv(f'{OUT}/nodes.tsv', nodes, ['id','entity','entity_type','degree','community'])
write_tsv(f'{OUT}/edges.tsv', edges, ['source_id','target_id','relation','weight','chunk_ids'])
write_tsv(f'{OUT}/meta.tsv', meta, ['key','value'])
# 清掉旧 csv(避免混淆)
import os as _os
for c in ('chunks.csv','nodes.csv','edges.csv','meta.csv'):
    p = f'{OUT}/{c}'
    if _os.path.exists(p): _os.unlink(p)
print(f'written TSV: chunks={len(chunks)} nodes={len(nodes)} edges={len(edges)} meta={len(meta)} -> {OUT}/')
