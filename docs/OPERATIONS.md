# Operations

## Dry-run rehearsal

1. Validate the site config (`config` / `validate`). Fix every reported error before a run.
2. Discover points (`config` / `discover`). This is read-only.
3. Start with `dry_run` true. Confirm the status page shows the dry-run banner, the state advances, and the manifest records `dry_run` overrides.
4. Confirm the NF client received no command writes and no BACnet writes.
5. Abort once during a step and confirm the run ends `ABORTED` with no overrides left.

## Lab checklist

Use a single AHU, priority 8, and the VAV step disabled for the first live attempt. Someone who can reach the equipment stays available for the whole run.

- `confirm_live` is set only for that start.
- The command lease and keepalive match the site config.
- Interlock limits match the equipment.
- After the run, every priority-8 slot this app wrote is empty and no `ftest-*` command is still active.
- The manifest step windows line up with the shadow `ftest_step_index` series.

## NEEDS_ATTENTION

The run enters `NEEDS_ATTENTION` when a release could not be verified. The global `ftest_needs_attention` is 1. Do not start another run.

1. Read the status page for the points that are still overridden.
2. Restore the device if it is offline, then `retry_release`.
3. If the points are already back to normal and the ledger is wrong, `acknowledge` only after a person has checked the priority arrays.

`acknowledge` clears the sticky flag. It does not write.
