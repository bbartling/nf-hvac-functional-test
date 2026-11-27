# Install

Install the app from this git repository into a Normal Framework instance that can run a Node.js app. The minimum version in `app.json` is a floor that has not been verified on a lab system (see design section 11).

```bash
git clone <repository-url> nf-hvac-functional-test
cd nf-hvac-functional-test
npm ci --omit=dev
```

Point the NF app installer at this directory. The app id is `nf-hvac-functional-test`.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `siteConfig` | empty | JSON site policy. Validate it before enabling a run. |
| `enabled` | true | When false, the 10 second tick does nothing. |
| `logLevel` | info | `debug`, `info`, `warn`, or `error`. |

`dry_run` inside `siteConfig` defaults to true. A live run also needs `confirm_live` on the start action.

The hook reads `siteConfig` and builds the plan from those point uuids. It does not query every point on the site. A binding query must include `equip_ref`. The on-box API base URL is the `nfBaseUrl` option or `NF_BASE_URL`, otherwise `http://127.0.0.1:8080`. State is written under `local/` (or `NF_HVAC_STATE_DIR`).

## Write guardrail

Deny writes by default. Add one allow rule for this app's API key, and clamp percent points to 0 through 100. The app still refuses BACnet priorities 1 and 2 and still defaults to priority 8.

Hooks:

- `tick` runs every 10 seconds (`FREQ=SECONDLY;INTERVAL=10`) with an 8 second invoke timeout.
- `admin` is on request: `start`, `abort`, `status`, `retry_release`, `acknowledge`, `config validate`, `config discover`.
