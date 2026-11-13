#!/usr/bin/env python3
"""为 10 个预置问题计算 16 维词频 TF 向量(同 build_corpus_tables 的 embedding 函数),
输出 /Users/sa/ws/kb-portable/vecs.json 供 index.html 内嵌(下拉选问题 -> 向量种子)。"""
import json, re
from collections import Counter
import jieba

CORPUS = json.load(open('/tmp/cmrc_corpus.json', encoding='utf-8'))
docs = CORPUS['docs']

STOP_WORDS = {'的','了','是','在','和','与','及','或','等','有','为','被','把','从','到','年','月','日','一个','这','那','也','都','很','可以','于','上','下','面','中','内','人','个','位','次','件','名','其','该','本','此','之','不','无','但','而','则','以','用','由','向','对','被','把','让','使','给','为','以','按','照','依','据','凭','靠','通','过','后','前','间','时','候','期','段','中','外','边','旁','侧','里','外','内','上','下','什么','怎么','如何','多少','哪','谁','为什么'}

def tokens(text):
    return [t for t in jieba.lcut(text) if len(t) >= 2 and not t.isdigit() and t not in STOP_WORDS]

DIM = 16
all_tokens = [t for d in docs for t in tokens(d['text'])]
vocab = [w for w, _ in Counter(all_tokens).most_common(DIM)]
print('top16 vocab:', vocab)

# 10 个预置问题: 5 单跳(从 CMRC 真实 question 里挑有区分度的)+ 5 跨段组合(围绕田径/摔跤/奥运实体链)
presets = [
    # 单跳: CMRC 原始题(来自 cmrc_corpus.json 的 questions)
    {'id': 'Q01', 'q': '1871年,阿道夫·恩格勒成为什么管理员?', 'type': 'single'},
    {'id': 'Q02', 'q': '拉脱维亚大学成立于哪一年?', 'type': 'single'},
    {'id': 'Q03', 'q': '查令十字在英国的地理地位是怎样的?', 'type': 'single'},
    {'id': 'Q04', 'q': '《蜜桃女孩》这部漫画是谁创作的?', 'type': 'single'},
    {'id': 'Q05', 'q': '2004年雅典奥运会中国凭邢慧娜在女子10000米、刘翔在男子110米跨栏取得两枚金牌。', 'type': 'single'},
    # 跨段: 围绕田径(60)+摔跤(85)实体链
    {'id': 'Q06', 'q': '2008年北京奥运会中国田径队和中国摔跤队的领队分别是谁?', 'type': 'multi'},
    {'id': 'Q07', 'q': '2008年北京奥运会中国田径队中,男子400米栏项目的参赛运动员是谁?', 'type': 'multi'},
    {'id': 'Q08', 'q': '2008年北京奥运会中国摔跤队中,男子古典式摔跤60公斤级项目中获得第4名的运动员又是谁?', 'type': 'multi'},
    {'id': 'Q09', 'q': '2008年北京奥运会中国田径队女运动员人数与摔跤队男运动员人数之和是多少?', 'type': 'multi'},
    {'id': 'Q10', 'q': '2008年北京奥运会中国代表团里,田径队参赛人数是多少?摔跤队有多少运动员?', 'type': 'multi'},
]

vecs = {}
for p in presets:
    c = Counter(tokens(p['q']))
    s = sum(c[w] for w in vocab)
    vecs[p['id']] = [round(c[w] / s, 4) if s else 0.0 for w in vocab]

out = {'vocab': vocab, 'presets': presets, 'vecs': vecs}
with open('/Users/sa/ws/kb-portable/vecs.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print('saved -> /Users/sa/ws/kb-portable/vecs.json')
for p in presets:
    v = vecs[p['id']]
    nz = sum(1 for x in v if x > 0)
    print(f'  {p["id"]} ({p["type"]}) {nz}非零: {v}')
