# Move to normalframework/nf-hvac-functional-test

The owner pushes or transfers the repository. This checkout cannot see the `normalframework` org. Do not force-push `main`. Do not change branch protection or the license as part of the move.

## License

- [ ] `LICENSE` stays Apache-2.0.
- [ ] `package.json` `"license"` stays `Apache-2.0`.
- [ ] `README.md` still points at `LICENSE`.
- [ ] Do not add a second license or change the copyright notice while moving.

## README

- [ ] `README.md` describes dry-run as the default, the Open-FDD role pin, and this checklist.
- [ ] No customer names, site names, or production tunnel hosts appear in the README, examples, or tests.
- [ ] Examples stay synthetic (`examples/site-config.example.json`).

## Branches

Remote heads before this prep: `main` only. The v0.1 and `cursor/*-cf35` stack branches are already gone. Nothing further to delete.

- [ ] `git ls-remote --heads origin` shows only `main` (plus this prep branch until it merges).
- [ ] After the prep pull request merges, delete `cursor/org-move-prep-50bb`.
- [ ] Do not recreate the closed stack (`v0.1/*`, `cursor/*-cf35`) in the org repository. One `main` push.

## CI

Workflow: `.github/workflows/ci.yml` on pull requests and on pushes to `main`.

Jobs, both Node 20 and Node 22:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run coverage`
- `npm run validate:examples`
- `npm run scan`
- `npm run roles:sync`
- `npm audit --audit-level=high`

`roles:sync` fetches `roles/openfdd-roles.json` from the public commit in `schema/openfdd-roles.pin.json`. It needs outbound HTTPS to `raw.githubusercontent.com`. It does not use a token. No Actions secrets are required for the current workflow.

- [ ] Confirm the org repository has no required secret this workflow does not already have (there are none today).
- [ ] `roles:sync` is green on `main` before the push.
- [ ] Leave `pinned_to_tag` false. The flip is a later edit, after the tag exists.

## Open-FDD 5.0.22 pin (do not flip yet)

`schema/openfdd-roles.pin.json`:

| Field | Current value |
| --- | --- |
| version | `1.1.0-draft.1` |
| sha256 | `43717ebc6187f678e3ee424b5e877f14dcd92e387bfdcedd7cbdb2f9b5eb85c1` |
| pinned_to_tag | `false` |
| intended_tag | `v5.0.22` |
| upstream.ref | `49d44e23f8be7da7aa34d10ff67cd50dee13d51b` |
| upstream path | `bbartling/open-fdd` `roles/openfdd-roles.json` |

Open-FDD tags use a `v` prefix (`v5.0.21` is the newest tag). `v5.0.22` is not tagged. The vendored file's `openfdd_release` field says `5.0.22` and `status` is `draft`. Role names are the 223P names. Wire units are the QUDT local names (`DEG_C`, `PA`, `PERCENT`, `PERCENT_RH`, `L-PER-SEC`). Haystack markers are the overlay. Issue #8 records why the hook does not run SHACL.

When `v5.0.22` exists, flip in one commit:

1. Set `pinned_to_tag` to `true`.
2. Set `upstream.ref` to the exact tag name.
3. Replace `vendor/roles/openfdd-roles.json` with the tagged file.
4. Set `sha256` and `version` from that file.
5. `npm run roles:sync` must pass. A renamed role fails the job.

Until that commit, `upstream.ref` stays a 40-character commit SHA.

## Bench dry run

The owner runs this on the bench Pi against a simulated BACnet device. Do not point the app at a production site, a production device instance, or a production NF tunnel. Do not map or poll every point. The plan uses the uuids in `siteConfig`.

1. Check out `main` after the prep pull request is merged.
2. Install the way `docs/INSTALL.md` describes. Leave `dry_run` at its default `true`. Do not set `confirm_live`.
3. Set `NF_BASE_URL` to the bench NF API if it is not `http://127.0.0.1:8080`.
4. Load a site config that lists only the simulated AHU and, if the simulator has one, a simulated VAV. Every binding is a uuid or a query with `equip_ref`.
5. Open the status page. A failed fetch must say `status unknown` and must not show the dry-run banner. A successful dry-run status must show the banner.
6. Start a dry run from the admin hook. Watch `local/state.json` and the NF command list. Expect no command and no priority-array write. The run may still reach `COMPLETE`.
7. Abort once from the status page. The request is `POST /api/v1/hooks/admin/invoke` with `{ "args": { "action": "abort" } }`. The page must show `RELEASING` or the error.
8. Only after that, set `dry_run` to `false` and start with `confirm_live: true`, still on the simulator. Use one AHU recirculation step with a short hold. Confirm a command whose `duration` looks like `300s`, a priority-8 write of the recirculation values, and a keepalive before the lease ends.
9. If `GET /api/v1/platform/env?name=BACNET_PRIORITY` returns an integer other than 8, the live run fails with `priority_mismatch` and creates no command. Match `write.bacnet_priority` to that value or leave the variable unset on the simulator.
10. Add the simulated VAV and run max-cooling. Confirm a write per box, not one fleet-wide number. The box maximum is what gets written when the simulator exposes it. Batch progress is `cursor.vav_index` in the state file.
11. Abort during the VAV step. Read the priority arrays. Slots this run wrote must be empty or still listed in the ledger as not released. A slot that still holds our value must not be marked released. An unreadable array must leave the run in `NEEDS_ATTENTION`.
12. Kill the hook process mid-step and let the next scheduled tick resume from `local/state.json`. The second process must keep the same run id and must release when the run ends.
13. Stop. Do not copy the bench config onto any other site.

## Push to the org repository

Run these from a clone whose `main` is the merged prep (the commands below use `origin` as `bbartling/nf-hvac-functional-test`).

```bash
git fetch origin main
git checkout main
git pull origin main
git remote add nf https://github.com/normalframework/nf-hvac-functional-test.git
git push nf main:main
```

If `nf` already exists:

```bash
git remote set-url nf https://github.com/normalframework/nf-hvac-functional-test.git
git push nf main:main
```

If the org repository was created by a GitHub transfer instead of an empty push, skip the push. The transfer keeps history, the Apache-2.0 `LICENSE`, and `main`. After either path, install on the bench from `normalframework/nf-hvac-functional-test` and repeat the dry run before any live building.

Do not replay the old pull-request stack in the org repository. Do not use `--force`.
