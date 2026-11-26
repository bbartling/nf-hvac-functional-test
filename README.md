# nf-hvac-functional-test

A Normal Framework (NF) app that runs automated HVAC functional tests on air handling units (AHUs), with an optional VAV max-cooling-airflow step. It overrides equipment into defined test states, captures higher-rate data tagged with run and step IDs, and always releases every override it wrote.

> Status: design stage. See [docs/DESIGN.md](docs/DESIGN.md). Nothing in this repository writes to equipment until v0.1 is built, and even then dry-run is the default.

## What it does

1. **AHU functional test.** Puts one AHU through a fixed sequence: baseline, full recirculation (OA damper and both coil valves closed), and optionally 100% outside air when economizer conditions are suitable. Holds each step for an adjustable time.
2. **Optional VAV max-cooling-airflow step.** Keeps the AHU in a test state and drives VAV boxes to maximum cooling airflow for an adjustable time (default 30 min), using one of three strategies: toggle a single BAS point, write a per-box flush-mode point, or write each box's airflow setpoint to its cooling maximum. Boxes that cannot be driven are skipped and reported.
3. **Data capture.** Samples the involved points at a higher rate during the test window into a dedicated NF layer, and writes a run manifest with step timestamps so SQL tools can label the data. Analysis is out of scope.
4. **Safety.** Dry-run by default, writes at a configurable BACnet priority (default 8), NF command contexts with a short lease and keepalive, a persisted override ledger, interlocks, and release on end, abort, timeout and restart.

Point roles use ASHRAE 223P-derived snake_case names (same convention as Open-FDD) and a per-site config maps roles to NF points. No site, equipment or point names are hard-coded.

## Documents

- [docs/DESIGN.md](docs/DESIGN.md): sequence, state machine, config schema, data logging, safety, NF integration, test plan.
- [docs/CURSOR_PROMPT.md](docs/CURSOR_PROMPT.md): build prompt for a Cursor cloud agent (v0.1).

## License

Apache-2.0. See [LICENSE](LICENSE).
