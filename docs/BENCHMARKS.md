# Evaluation and Benchmark Methodology

The benchmark contains two independent checks:

1. a transparent 30-tool, 30-intent corpus that reports recall at 1, recall at
   5, misses, and estimated schema-token reduction;
2. a synthetic 10,000-tool catalog that reports index build time, heap change,
   and p50 and p95 route latency.

Run the checked-in corpus:

```bash
npm ci
npm run benchmark
```

The corpus is intentionally readable and should be replaced or extended with
representative production tools before selecting thresholds. Synthetic
catalog latency is a regression baseline, not a promise for every vocabulary,
schema size, CPU, or runtime.

Report the commit, Node.js version, CPU, raw JSON output, catalog shape, and
query set when sharing results. Do not tune against a hidden test set and then
present the same set as independent evaluation.
