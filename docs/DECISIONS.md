# Decisions

Gaps and departures from `docs/DESIGN.md`. The design remains the spec except where a row here says otherwise.

## D1. Test runner

`node:test` and `tsc --noEmit` on JSDoc. One runner for the app. No TypeScript emit.

## D2. Schema and defaults

`schema/site-config.schema.json` is JSON Schema 2020-12, checked with Ajv. The schema describes operator input. Omitted fields take the defaults in `lib/config/defaults.js`. `dry_run` defaults to true. `bacnet_priority` defaults to 8.

## D3. Priorities 1 and 2

Rejected by `checkPriority` and by the schema (integer 3 to 16). There is no override flag.

## D4. Command lease

`keepalive_s` must be less than `command_lease_s`. The lease maximum is 86400 seconds (the command service 24 hour limit). The minimum lease is 30 seconds. `release_backoff_s` must contain at least `release_retries` entries.

## D5. Unimplemented catalog steps

Section 3.4 step ids are valid in the schema. Enabling one fails config validation with `step_not_implemented`. The planner also skips an enabled catalog step with that reason.

## D6. max_concurrent_runs

v0.1 accepts only 1.

## D7. max_reads_per_s

Default 50, used only when logging mode is `period_boost` or `both`. The default mode is `shadow`. Open question 1 is unverified, so period boost stays off.

## D8. Plausible clamps

Air temperatures -50 to 80 degC. Relative humidity and percent commands 0 to 100. Duct static pressure -500 to 5000 Pa. Airflow 0 to 100 m3/s before any tighter cap. These are sanity bounds, not site setpoints.

## D9. Equipment ids

`^[a-z][a-z0-9_]{0,63}$`. `serves` may only list VAV ids in the same config.

## D10. API scopes and minimum version

`app.json` scopes are the open-fdd app scopes. They are not verified against a running NF (open question 3). `minNfVersion` is `3.10.0` because the design says the command lease and zombies arrived in 3.10.x. That floor is not a lab-verified minimum.

## D11. siteConfig option

The app option defaults to an empty string so the app can be installed before a config exists. An empty config does not validate and cannot start a run.

## D12. ftest layer

Indexed components `equipment_id`, `role`, `source_uuid`. No protocol driver. Shadow points are written with the data API.

## D13. Coverage floor

`scripts/check-coverage.js` requires 90 percent line coverage on the config, role, model, and plan modules, and on the safety modules in section 9.5 once those files exist. The coverage run does not pass `--test-coverage-include`; Node 20 rejects that flag. The script expands `test/*.test.js` itself because Node 20 does not expand that glob. Files under test are loaded by the test suite, and a required file with no line data fails the check.

## D14. Forbidden-identifier scan

`.github/forbidden-words.txt` is the denylist and is excluded from the scan. The scanner also rejects private-key blocks and common token prefixes.

## D15. Data-model-driven planning

Owner requirement, applied before any sequencer was written.

The Haystack tag adapter is the primary model input. It reads NF point tags and layers directly. The RDF/223P adapter reads a local Turtle file and does not call NF. Both produce one internal model. `lib/plan.js` is pure.

`schema/haystack-role-map.json` and `schema/rdf-role-map.json` are versioned. `mergeMaps` overlays a site file onto the shipped map.

Writable comes from the `writable` marker. A `cmd` or `sp` tag does not make a point writable by itself. `evaluateWrite` refuses the write when the model marker is absent, even if config sets `writable: true`. When a config binding exists it must also set `writable: true` (operator allow-list). A discovered point with no config binding is allowed when the model marks it writable. `confirmRuntime` then requires a priority array and, when a readback probe is present, a matching readback. Disagreement skips the point; it does not write it.

`air flow sp` plus `writable` maps to `cooling_air_flow_setpoint`, not to `cooling_air_flow_maximum`. The maximum stays the read-only cap from section 5.1. The requirement's example named the maximum role for the writable airflow point; the design table gives that job to the setpoint role. Sites that tag the cap differently edit the JSON map.

`ahu.economizer` is skipped with `economizer_points_missing` unless `outside_air_damper_command` is model-writable. Recirculation still runs from the coil commands when the damper point is absent. The damper is written during recirculation only when the model marks it writable. Weather remains a runtime precondition (`econ_window`), not a planning input.

A VAV box is not special-cased by id. Strategy order is the site policy (`auto`, `auto_per_box`, or one strategy). The model decides which of those strategies each box supports. Boxes past `max_boxes_overridden` are skipped with `over_box_limit` after sorting ids, so the cut is stable and not a per-box rule.

Interlocks whose input points are unbound are omitted from the plan. Required AHU sensor roles (`requirement: yes`) still fail config validation when an AHU equipment entry lists points and omits one. Write roles are not required at config validation time; a missing write role becomes a skipped step.

## D18. Haystack role matching

Matching is longest tag set, then a hard rule: a `cmd` marker keeps only roles that list `cmd`. An equal-length tie assigns no role and is reported on the model `ambiguous` list. Setpoint roles forbid `max` and `min`. The shipped map uses Haystack 4 tokens (`cool`, `heat`, `freezeStat`, `ductStatic`, damper tags without `air`). `class` and comma-separated `markers` are tag sources. Role ids stay in `lib/roles.js` and `schema/haystack-role-map.json`.

## D16. Assumed NF routes

Point query, point upsert, and AddData are `POST /api/v1/point/query`, `/api/v1/point/upsert`, and `/api/v1/data`. Direct BACnet is `POST /api/v2/bacnet/read` and `/api/v2/bacnet/write`. Command routes follow the command service under `/api/v2/command`. None of the point or BACnet paths were verified on a running NF (section 11, questions 2 and 6). `cancel_on_conflict` fails the new write and leaves the existing command running. The fake listens on `127.0.0.1` only and is not part of the installed app.

## D17. Release verification

A corrupt JSONL line is skipped wherever it sits, so one bad line cannot hide earlier overrides. After `CancelCommand`, a slot that is still occupied is relinquished with a NULL write at the same priority. That covers a zombie the command service did not clear. Other slots are not written. A `failed` ledger result removes that override; an `intent` with no result is treated as possibly written and is released.

## Open questions

Section 11 is still open. Nothing in it was verified against a running NF. `period_boost` stays off.
