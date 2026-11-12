import csv
from collections import Counter, defaultdict
import igraph as ig, leidenalg as la

mine = {}
for row in csv.DictReader(open("mine_rust.csv")):
    mine[row["node_id"]] = int(row["community"])

edges = [(r["source_id"], r["target_id"], float(r["weight"])) for r in csv.DictReader(open("edges.csv"))]
nodes = sorted({n for a, b, _ in edges for n in (a, b)})
idx = {n: i for i, n in enumerate(nodes)}
g = ig.Graph(directed=False)
g.add_vertices(nodes)
g.add_edges([(idx[a], idx[b]) for a, b, _ in edges])
g.es["weights"] = [w for _, _, w in edges]
part = la.find_partition(g, la.RBConfigurationVertexPartition, weights=g.es["weights"], seed=42)
ref = [part.membership[idx[n]] for n in mine]

def nmi(x, y):
    from math import log
    cnt = defaultdict(lambda: defaultdict(int))
    for a, b in zip(x, y):
        cnt[a][b] += 1
    tx = Counter(x)
    ty = Counter(y)
    n = sum(x)
    def H(p):
        return -sum((c / n) * log(c / n) for c in p if c > 0)
    Hx = H(list(tx.values()))
    Hy = H(list(ty.values()))
    mi = 0.0
    for a in cnt:
        for b in cnt[a]:
            mi += (cnt[a][b] / n) * log(cnt[a][b] * n / (tx[a] * ty[b]))
    return mi / max(Hx, Hy)

print("NMI(mine_multilevel vs leidenalg) =", round(nmi(list(mine.values()), ref), 4))
print("K mine =", len(set(mine.values())), " K ref =", len(set(ref)))
