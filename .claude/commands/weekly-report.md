---
description: Learn from last week's results and rewrite the playbook
---
1. Read `engine/data/performance.json` (rows: id, date, format, hook, hookType, cutsPer5s, payoffSec, loop, views, reach, avgWatchSec, shares, saves).
2. Compare top 25% vs bottom 25% on every feature. Only claim a pattern with n ≥ 4.
3. Update `engine/brand/playbook.md`: adjust confidence of existing rules, add new ones, retire rules below 40%.
   Always keep the evidence column honest.
4. Write `engine/out/report-<date>.md`: wins, flops, why, 3 experiments for next week.
5. Output JSON: { "summary": string, "playbookChanges": string[], "experiments": string[] }
