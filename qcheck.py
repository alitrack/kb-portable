import csv
from collections import defaultdict

edges = [(r["source_id"], r["target_id"], float(r["weight"])) for r in csv.DictReader(open("edges.csv"))]
u = set()
wmap = {}
for a, b, w in edges:
    u.add(a)
    u.add(b)
    key = (a, b) if a < b else (b, a)
    wmap[key] = wmap.get(key, 0) + w
W = sum(wmap.values())
deg = defaultdict(float)
for (a, b), w in wmap.items():
    deg[a] += w
    deg[b] += w

gt = lambda n: int(n[1:]) // 100

def Qof(part):
    L = defaultdict(float)
    kd = defaultdict(float)
    for n in u:
        kd[part[n]] += deg[n]
    for (a, b), w in wmap.items():
        if part[a] == part[b]:
            L[part[a]] += w
    tot = 0.0
    for c in kd:
        tot += L[c] / W - (kd[c] / (2.0 * W)) ** 2
    return tot

print("total edge weight W =", W, "nodes =", len(u))
print("ground truth Q =", round(Qof(gt), 5))
myn = {}
for row in csv.DictReader(open("mine_rust.csv")):
    myn[row["node_id"]] = int(row["community"])
print("my 9-comm Q =", round(Qof(myn), 5))

from collections import Counter
ct = Counter((gt(n), myn[n]) for n in u)
print("truth -> my crosstab:")
for c in range(6):
    row = dict(sorted((s, n) for (gc, s), n in ct.items() if gc == c))
    print("  truth", c, "->", row)
