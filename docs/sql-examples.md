# Labeling trends with the manifest

The manifest lists each step with `started_at` and `ended_at`. Join those windows to the shadow series `ftest_step_index` (or to a source trend) to label samples. Replace the placeholders with the run id and the point column names you query. No site identifiers belong in this file.

## DuckDB

```sql
SELECT s.ts, s.value, m.step_id
FROM read_json_auto('samples.json') AS s
JOIN read_json_auto('manifest-steps.json') AS m
  ON s.ts >= m.started_at
 AND s.ts < m.ended_at
WHERE m.run_id = 'run_operator';
```

## PostgreSQL

```sql
SELECT s.ts, s.value, m.step_id
FROM samples AS s
JOIN manifest_steps AS m
  ON s.ts >= m.started_at
 AND s.ts < m.ended_at
WHERE m.run_id = 'run_operator'
ORDER BY s.ts;
```
