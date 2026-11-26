# RDF alignment implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the hand-written Turtle reader from binding roles, then accept RDF only through vendored Oxigraph 0.5.13 and the shared 223P role file keyed by IRI.

**Architecture:** Haystack tags stay the model that plans a test. This PR removes the splitter and the local-name type map. RDF calls throw `RdfInputDisabledError`. A later PR, after the review names the shared role file, vendors the Node Oxigraph 0.5.13 build, checks its sha256 pin, and binds roles with the file's SPARQL plus a precomputed JSON binding. OntoEnv and Shifty run in CI only.

**Tech Stack:** Node.js 20+, vendored Oxigraph 0.5.13 (`Store.load` / `Store.size` / `Store.query`), JSON pin, CI Python `rdflib==7.6.0` `ontoenv==0.6.4` `pyshifty==0.6.0`.

## Global Constraints

- Dry-run stays the default. Live writes need `dry_run: false` and `confirm_live: true`.
- BACnet priority default 8, range 3–16, priorities 1 and 2 rejected.
- No site, building, equipment, point, client, vendor product, or people names. Synthetic ids only.
- No network I/O in tests. The Oxigraph wasm is local. Tests must not fetch ontologies.
- Haystack remains the primary model path.
- Do not vendor Oxigraph or invent role IRIs until the review that names the shared role file has landed.
- 223P ontology sha256 `08f80bd6e15052f28cdfd354bdf46ff96e5e1afdba36a4dbed5186fc1ea51c41`. QUDT 3.4.0 via imports. No Brick-name matching.
- Zero or several role matches bind nothing.

---

### Task 1: Fail closed (landed on this branch)

**Files:**
- Modify: `lib/model/rdf.js`
- Create: `lib/model/errors.js`, `lib/model/role_iri.js`, `lib/model/role_pin.js`, `schema/shared-role-file.pin.json`
- Delete: `schema/rdf-role-map.json`
- Test: `test/rdf.test.js`

**Interfaces:**
- Produces: `loadRdfModel(text, map)` throws `RdfInputDisabledError` with `code === 'rdf_input_disabled'`.
- Produces: `matchRoleIri(typeIris: readonly string[], rolesByIri: ReadonlyMap<string, string>) => string | null`.
- Produces: `checkVendoredRoleFile(root: string) => { vendored: boolean, sha256: string | null }` or throws `RoleFilePinError` with `role_file_hash_mismatch`, `role_file_missing`, or `oxigraph_pin`.

- [x] **Step 1:** Replace the splitter with the error. Role matching by local name is not reachable.
- [x] **Step 2:** Pin Oxigraph `0.5.13` and a null role-file sha256. A different hash fails the test.
- [x] **Step 3:** `node --test test/rdf.test.js` passes. Haystack plan tests still pass.

### Task 2: Vendor Oxigraph 0.5.13 after the review

**Files:**
- Create: `vendor/oxigraph/node.js`, `vendor/oxigraph/node_bg.wasm`, `vendor/oxigraph/package.json`, `vendor/oxigraph/LICENSE-MIT`, `vendor/oxigraph/LICENSE-APACHE`
- Create: `lib/model/oxigraph_store.js`
- Modify: `lib/model/rdf.js`
- Test: `test/rdf.test.js`

Do not copy `web.js` or `web_bg.wasm`. Copy the Node files from the upstream NF app path `nf-app/static/vendor/oxigraph/` at the commit whose `package.json` version is `0.5.13`. Record that commit in `vendor/oxigraph/SOURCE`.

**Interfaces:**
- Consumes: `Store` from `vendor/oxigraph/node.js`. `store.load(text, 'text/turtle')`, then `store.size`.
- Produces: `countTriples(text: string) => number`. Parse errors propagate. This function does not bind roles.

- [ ] **Step 1: Write the failing count test**

```javascript
const { countTriples } = require('../lib/model/oxigraph_store');
const fs = require('node:fs');
const path = require('node:path');

test('oxigraph counts every triple in the object-list fixture', () => {
  const text = fs.readFileSync(path.join(__dirname, 'fixtures/rdf/object-list.ttl'), 'utf8');
  assert.equal(countTriples(text), 4);
});
```

The object-list fixture is four triples: three objects in the `s223:label` list, plus `s223:count 2`. The hand reader would have kept two statements and glued the list into one string.

- [ ] **Step 2: Run it and confirm `countTriples` is missing**

Run: `node --test test/rdf.test.js`

Expected: FAIL, cannot find `countTriples`.

- [ ] **Step 3: Implement the counter**

```javascript
'use strict';

const { Store } = require('../../vendor/oxigraph/node.js');

function countTriples(text) {
  const store = new Store();
  try {
    store.load(text, 'text/turtle');
    return store.size;
  } finally {
    store.free();
  }
}

module.exports = { countTriples };
```

- [ ] **Step 4: Add the upstream export fixture**

Generate Turtle with the upstream `tools/rdf-check` generic fixture. Scan the file with `npm run scan` before committing. Save it as `test/fixtures/rdf/upstream-export.ttl`. The Oxigraph count on that file is 122. Replace the fail-closed assertion for that fixture with:

```javascript
test('upstream export fixture has 122 triples', () => {
  const text = fs.readFileSync(path.join(__dirname, 'fixtures/rdf/upstream-export.ttl'), 'utf8');
  assert.equal(countTriples(text), 122);
});
```

- [ ] **Step 5: Add the 223P snapshot export**

Save a name-scanned copy as `test/fixtures/rdf/snapshot-223p.ttl`. The test is `countTriples(text)` does not throw.

- [ ] **Step 6: Run `npm test` and commit**

`loadRdfModel` still throws until Task 4. Counting triples is not planning a test.

### Task 3: Vendor the shared role file

**Files:**
- Create: `vendor/roles/shared-223p-roles.ttl` (bytes from the review, unmodified)
- Modify: `schema/shared-role-file.pin.json` (`status` becomes `vendored`, `sha256` is the file's sha256)
- Test: `test/rdf.test.js` already fails on a hash mismatch

- [ ] **Step 1:** Set `sha256` to the hex digest of the file the review names. Do not edit the Turtle.
- [ ] **Step 2:** `checkVendoredRoleFile` on the repo root returns `{ vendored: true, sha256: <pin> }`.
- [ ] **Step 3:** Flip one byte in a temp copy and assert `role_file_hash_mismatch`.

### Task 4: Precomputed binding and IRI queries

**Files:**
- Create: `schema/role-binding.json` generated from the role file. Each entry is `{ "iri", "role", "nf_markers", "unit", "requirement" }`. `role` is the snake_case id already in `lib/roles.js`.
- Create: `lib/model/binding.js`
- Modify: `lib/model/rdf.js` so `loadRdfModel` uses Oxigraph plus the binding. It must not read `rdf-role-map.json` (that file stays deleted).

**Interfaces:**
- Produces: `loadBinding() => { iri: string, role: string, nf_markers: string[], unit: string, requirement: 'yes' | 'no' }[]`
- `loadRdfModel` returns the same internal model shape Haystack returns: `{ source: 'rdf', equipment: [...] }`. A point's role is `matchRoleIri(typeIris, rolesByIri)` where `rolesByIri` is built from `role-binding.json`. SPARQL text is copied from the shared role file. Do not match `brick:` local names.

- [ ] **Step 1:** A fixture with `https://brickschema.org/schema/Brick#Sensor` and `urn:local:Sensor` binds a role only for an IRI listed in the binding. The other stays unbound.
- [ ] **Step 2:** Two binding hits on one point leave the role unset.
- [ ] **Step 3:** Haystack `loadHaystackModel` is unchanged. `lib/plan.js` is unchanged.

### Task 5: CI validation job

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `examples/models/` with the synthetic Turtle the review accepts
- Create: `scripts/validate_rdf.py`

Add this job only when `examples/models/` contains Turtle that passes Shifty. An empty job that always fails is not part of this plan.

```yaml
  rdf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install rdflib==7.6.0 ontoenv==0.6.4 pyshifty==0.6.0
      - run: python scripts/validate_rdf.py examples/models
```

`validate_rdf.py` builds an OntoEnv closure and runs Shifty with the baseline call and defaults. Exit 1 if the report contains a Violation. It does not run on the NF hook path.

- [ ] **Step 1:** Run the script locally on `examples/models`.
- [ ] **Step 2:** Commit the workflow. CI on Node 20 and Node 22 stays green, and the new job is green.
