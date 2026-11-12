#!/usr/bin/env python3
"""Reference validator: compare a partition (mine_rust.csv: node_id,community)
against leidenalg on the same edges.csv, and against ground truth (gen_graph.sql)."""
import csv, sys, random
from collections import Counter
import igraph as ig
import leidenalg as la

random.seed(42)

edges = []
with open("edges.csv") as f:
    for row in csv.DictReader(f):
        edges.append((row["source_id"], row["target_id"], float(row["weight"])))
nodes = sorted({n for a, b, _ in edges for n in (a, b)})
idx = {n: i for i, n in enumerate(nodes)}
g = ig.Graph(directed=False)
g.add_vertices(nodes)
g.add_edges([(idx[a], idx[b]) for a, b, _ in edges])
g.es["weights"] = [w for _, _, w in edges]

# ground truth communities (from gen_graph formula: community = node_idx/100)
def true_comm(nid):
    i = int(nid[1:])
    return i // 100
gt = [true_comm(n) for n in nodes]

# leidenalg reference (same as GraphRAG/LightRAG-style community step)
part = la.find_partition(g, la.RBConfigurationVertexPartition,
                         weights=g.es["weights"], seed=42)
ref_comm = list(part.membership)
ref_mod = part.modularity

# my rust partition
mine = {}
if len(sys.argv) > 1:
    with open(sys.argv[1]) as f:
        for row in csv.DictReader(f):
            mine[row["node_id"]] = int(row["community"])
    assert len(mine) == len(nodes), f"node count mismatch {len(mine)} != {len(nodes)}"
    my_comm = [mine[n] for n in nodes]
else:
    my_comm = None

def nmi(a, b):
    # normalized mutual information
    from collections import Counter
    ca, cb = Counter(a), Counter(b)
    n = len(a)
    def ent(c):
        from math import log
        p = [v/n for v in c.values()]
        return -sum(x*log(x) for x in p if x)
    from math import log
    ca2 = Counter(zip(a, b))
    mi = 0.0
    for (x, y), cnt in ca2.items():
        pxy = cnt/n
        mi += pxy * log(pxy / ((ca[x]/n) * (cb[y]/n)))
    ea, eb = ent(ca), ent(cb)
    return mi / max(ea, eb)

print(f"nodes={len(nodes)} edges(simplified)={len(g.es)}")
print(f"ground-truth communities: 6 (sizes {sorted(Counter(gt).values())})")
print(f"leidenalg reference: k={len(set(ref_comm))} mod={ref_mod:.4f} NMI_vs_truth={nmi(ref_comm, gt):.4f}")
if my_comm is not None:
    mc = Counter(my_comm)
    print(f"rust leiden:          k={len(mc)} sizes={sorted(mc.values())}")
    print(f"  NMI(vs reference)={nmi(my_comm, ref_comm):.4f}")
    print(f"  NMI(vs ground truth)={nmi(my_comm, gt):.4f}")
    # modularity of my partition
    g2 = ig.Graph(directed=False); g2.add_vertices(nodes)
    g2.add_edges([(idx[a], idx[b]) for a, b, _ in edges]); g2.es["weights"]=[w for _,_,w in edges]
    g2.simplify(multiple=True)
    mp = la.GraphVectorPartition(g2, membership=my_comm, weights=g2.es["weights"])
    print(f"  modularity={mp.modularity():.4f}")
    # exact agreement with reference
    agree = sum(1 for x, y in zip(my_comm, ref_comm)
                if next(m for m in mc if any(mc[m]==x)) == 0)  # placeholder
    # simple exact-match after relabeling is hard; use contingency
    from collections import defaultdict
    tab = defaultdict(int)
    for x, y in zip(my_comm, ref_comm):
        tab[(x, y)] += 1
    exact = sum(1 for a, b in zip(my_comm, ref_comm) if a == b)
    print(f"  exact-label agreement (before relabel)={exact}/{len(my_comm)}")
