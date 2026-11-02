# Bitcore workspaces: execution and acceptance contracts

This specifies the workspace tooling's execution contracts and the checks required for migration acceptance. The referenced scripts are implemented in `scripts/workspaces` and their fixtures in `test/workspaces`. See the [maintainer guide](README.md) for command usage. This document defines requirements; it does not declare that every acceptance gate has passed.

## 1. Workspace membership and commands

Use this root workspace list. Its order is stable discovery order; the compile runner owns build order independently.

```json
{
  "workspaces": [
    "packages/bitcore-build",
    "packages/bitcore-cli",
    "packages/bitcore-client",
    "packages/bitcore-lib",
    "packages/bitcore-lib-cash",
    "packages/bitcore-lib-doge",
    "packages/bitcore-lib-ltc",
    "packages/bitcore-logging",
    "packages/bitcore-mnemonic",
    "packages/bitcore-node",
    "packages/bitcore-p2p",
    "packages/bitcore-p2p-cash",
    "packages/bitcore-p2p-doge",
    "packages/bitcore-tss",
    "packages/bitcore-wallet-client",
    "packages/bitcore-wallet-service",
    "packages/crypto-rpc",
    "packages/crypto-wallet-core"
  ]
}
```

Required root script values:

| Script | Value |
| --- | --- |
| `preinstall` | `node scripts/workspaces/check-runtime.cjs` |
| `postinstall` | `node scripts/workspaces/verify.cjs engines && npm run compile` |
| `compile` | `node scripts/workspaces/compile.cjs` |
| `node` | `npm start --workspace=@bitpay-labs/bitcore-node --` |
| `bws` | `npm start --workspace=@bitpay-labs/bitcore-wallet-service --` |
| `watch` | `npm run watch --workspace=@bitpay-labs/bitcore-client --` |
| `build` | Existing root `docker build -t bitcore-node .` |
| `build:docker` | `npm run build:docker --workspace=@bitpay-labs/bitcore-node && npm run build:docker --workspace=@bitpay-labs/bitcore-wallet-service` |
| `insight:install` | `npm --prefix packages/insight ci --workspaces=false` |
| `insight:build` | `npm run insight:install && npm --prefix packages/insight run build --workspaces=false` |
| `test:bitcore-client` | `npm run compile && npm run test --workspace=@bitpay-labs/bitcore-client --` |
| Other existing `test:<directory>` aliases | `npm run test --workspace=@bitpay-labs/<directory> --` |

There is no `bootstrap` step. Do not change root lint/fix/hook scripts unless their execution demonstrably regresses. Trailing `--` in test wrappers preserves argument forwarding; verify with `npm run test:<directory> -- --grep <known-test>` in a fixture and one actual package. Do not forward test filters into the preparatory root compile.

Root runtime metadata: `private: true`, `name: bitcore-monorepo`, `engines.node: >=24.22.1 <25`, `packageManager: npm@11.19.1`. Keep the root version. Use Node 24.22.1 and exact npm 11.19.1 for reproducible candidate runs. Historical Node 22/npm 10 results do not establish acceptance of this pair. Published workspace engine ranges follow their own manifests and must not be changed merely to satisfy the root verifier.

## 2. Compile and lifecycle contract

Sequential compile order:

```text
@bitpay-labs/bitcore-logging
@bitpay-labs/crypto-wallet-core
@bitpay-labs/bitcore-wallet-service
@bitpay-labs/bitcore-wallet-client
@bitpay-labs/bitcore-client
@bitpay-labs/bitcore-cli
@bitpay-labs/bitcore-node
```

Invoke each package through `npm run compile --workspace=<name>` with inherited environment and streamed output. Do not invoke `tsc` centrally; each package selects its compiler and lifecycle. Stop before the next package after any nonzero exit. Propagate interruption to the running child and wait for it to terminate. Keep a fixture that records invocation order, has one prerequisite fail, and asserts later packages never start. Discovery must reject a new compile-bearing workspace until the explicit order is updated.

Client compilation contract:

- There is no client `precompile` hook that builds node.
- Use `compile: npm run clean && npm run build:prod`.
- Keep `build:prod: tsc -p tsconfig.prod.json`, with explicit `rootDir: "."` so source emits to `ts_build/src`.
- Run `test:types: tsc --noEmit -p tsconfig.json` in the package test script after production compilation and before its test runner.
- Leave test imports of node output intact initially. Root preparation creates that output before tests. Production compile must not read or clean node output.

Proof of the cycle fix: with dependencies available and node build output absent, client production compilation succeeds and creates its declared main/types. Then a clean root compile builds node including its tests using the newly compiled local client. Client tests and their type check execute after node output exists.

Normal `npm ci` is the supported development/image install and includes compilation. `npm ci --ignore-scripts` does not create a ready environment. `npm ci --omit=dev` is not a supported shortcut for these images: their current compilation uses development tools. Production dependency pruning is a separate follow-up.

## 3. Runtime and dependency-engine checks

`check-runtime.cjs` uses only Node built-ins. It checks the running Node major, the minimum Node version, and actual npm version, obtained from npm's lifecycle environment or an explicit `npm --version` subprocess when called directly. It requires stable Node >=24.22.1 <25 and npm exactly 11.19.1, and fails if npm is absent or unidentified. It prints a useful expected/observed diagnostic and exits nonzero. Fixtures cover rejection of Node 20, 22, 25, below-minimum Node 24, and unsupported npm, plus acceptance of supported Node 24 releases. Execute the real script under the supported pair for candidate validation.

CI and Docker run preflight before installation. Root preinstall is a second check, not a substitute for preflight. The compile runner also calls it. Documentation lists the command before initial install.

Root `.npmrc` sets `engine-strict=false`. npm's graph-wide strict setting is unsuitable for this existing graph because `socks5-client@0.3.6` declares `0.x`. Root postinstall instead runs the engine verifier after dependencies have been installed and before compilation. This verifies metadata; native-load and application tests verify actual compatibility.

The engine verifier checks installed packages reachable from the root/backend workspace graph, including their development tooling. Use the root lock as the installation inventory and actual installed manifests as the engine declarations. Resolve workspace links to their real packages; deduplicate real paths. Skip optional packages not installed for this platform. Missing required packages fail separately. Do not scan excluded Insight/benchmark trees or unrelated files outside the graph.

The only initial exception is the tuple `socks5-client`, `0.3.6`, Node range `0.x`. Log every resolved instance using it. A different version/range or any other incompatible package fails. A future compatible replacement removes the exception; do not add wildcard exceptions. Unparseable engine ranges fail diagnostically. Packages without engine metadata are reported as unspecified, not declared compatible by metadata.

The three P2P suites include a `set a proxy` test that constructs a `Socks5Client`. Preserve those checks and the full suites. They do not prove interoperability with a real SOCKS server; do not claim that stronger result without an additional integration test. TSS's dependency graph gets no legacy exception merely because another workspace uses socks5-client.

## 4. Verifier modes and timing

| Invocation | When | Required behavior |
| --- | --- | --- |
| `verify.cjs manifests --structure-only` | Before dependencies | Built-in JSON checks for membership, root privacy/identity, runtime metadata, required script mapping and forbidden local protocols. |
| `verify.cjs manifests` | After install | Structural checks plus semver compatibility for every declared internal edge. Declare the semver library directly. |
| `verify.cjs lock` | After generating candidate lock, before install | v3 root lock, 18 workspace records/links, manifest agreement, expected lock ownership. Do not inspect the installation yet. |
| `verify.cjs engines` | After dependencies; root postinstall | Installed engine policy in section 3. |
| `verify.cjs links` | After install | Every internal edge resolves from its consumer to the expected local package; no registry substitute or wrong nested copy; the same workspace is not reachable through multiple distinct lexical symlink aliases. |
| `verify.cjs artifacts --stage=build` | After normal install/compile | Required executable/declaration/template outputs and first-install CLI link. |
| `verify.cjs artifacts --stage=test-fixtures --workspace=<name>` | After that package's test preparation | Correct copied fixtures for wallet-client or CLI. Reject unsupported workspace/stage combinations. |

Before compilation, link checks can resolve the package manifest rather than importing an entry point whose output is not built. After compilation, additionally resolve actual entry points for runtime packages. Resolution originates from each consumer via `createRequire` or the appropriate ESM mechanism; do not import service entry points merely to check paths.

Link verification must preserve the distinction between the lexical package-resolution path returned by that consumer-originating resolution and the canonical real path after `realpath`: it records both for every internal edge. Resolution to the correct physical workspace is necessary but not sufficient. The verifier must also detect when the same internal workspace is exposed through multiple distinct symlink aliases, grouping resolutions by intended workspace target and failing when consumers disagree on the lexical alias even though both aliases canonicalize to that workspace. A failure reports the workspace package, the consumer, the lexical resolved path, the canonical real path, the conflicting consumer/path, and the expected canonical workspace location.

Build artifact minimums, relative to each package:

| Package | Required output |
| --- | --- |
| logging, crypto-wallet-core, wallet-service, wallet-client, client | `ts_build/src/index.js` and `ts_build/src/index.d.ts` |
| wallet-service | Template tree copied from `templates` to `ts_build/templates`; declared worker/server entry points used by start scripts. |
| CLI | `build/src/cli.js`, tracked executable `bin/bitcore-cli`, and runnable root `node_modules/.bin/bitcore-cli --help`. |
| node | `build/src/server.js`; node client tests' required `build/src/services/api.js`, `storage.js`, and `build/src/modules/index.js`. |
| JavaScript workspaces | Existing declared entry files resolve locally; no compile output is invented for them. |

For wallet-client fixture stage, compare hashes of top-level `test/data/*.json` with copied `ts_build/test/data/*.json`. For CLI, compare copied files from `test/wallets` to `build/test/wallets`. An install-only gate must not require these test-copy scripts to have run.

Each failure includes mode, consumer/workspace, expected versus observed path/version, and exits nonzero. Do not count a missing verifier script or absent browser as the intended RED. Keep fixtures for wrong local resolution, absent artifact, unexpected engine mismatch, and runtime rejection; simple manifest fields can use one-shot assertions.

## 5. Historical baseline/current command mapping

| Behavior | Existing Lerna baseline | Workspace candidate |
| --- | --- | --- |
| Install and compile | `npm ci --foreground-scripts` | Preflight, then the same install command. |
| Membership | Installed `node node_modules/lerna/cli.js list --all --json` | `npm pkg get name --workspaces` plus exact membership check. |
| Workspace absence RED | `npm pkg get name --workspaces` must fail with the workspace diagnostic | Same discovery must return the intended 18 names. |
| Recompile | `npm run compile` | Same public command; different orchestrator. |
| Existing package regressions | Existing root `test:<directory>` aliases | Same public aliases. |
| TSS browser | `npm --prefix packages/bitcore-tss run test:web` | `npm run test:web --workspace=@bitpay-labs/bitcore-tss` |
| Node script tests | `npm --prefix packages/bitcore-node run test:scripts` | `npm run test:scripts --workspace=@bitpay-labs/bitcore-node` |
| Insight | `npm run insight:build` | Same public command, now with a locked independent install. |
| Shared helper own test | Existing `gulp test` has no own gulpfile; record as a baseline defect. Consumer suites provide baseline coverage. | `node --test packages/bitcore-build/test/tool-resolution.test.cjs` plus the same consumer suites. |
| Runtime/engine checks, runner fixture, artifact verifier | No equivalent repository scripts; capture source facts and use independent behavioral fixtures. | The implemented verifier/fixture commands in section 6. |

Do not run current workspace-only commands blindly against the historical baseline. Treat new-script absence as inventory, not behavioral RED. Keep deliberate expected-failure commands separate from shell sequences that expect zero throughout.

## 6. Cold acceptance sequence

Use a fresh checkout of the committed candidate in a dedicated temporary directory. Do not copy existing ignored dependency/output directories into it. If using `git archive`, initialize a scratch git repository and commit the imported candidate before checking post-install diffs; an archive alone has no git metadata. Record the original candidate commit separately.

Run these as separate recorded commands, stopping on an unexpected failure:

```bash
node scripts/workspaces/check-runtime.cjs
node scripts/workspaces/verify.cjs manifests --structure-only
node scripts/workspaces/verify.cjs lock
npm ci --foreground-scripts
node scripts/workspaces/verify.cjs manifests
node scripts/workspaces/verify.cjs engines
node scripts/workspaces/verify.cjs links
node scripts/workspaces/verify.cjs artifacts --stage=build
npm ls --workspaces --depth=0
node --test test/workspaces/*.test.cjs
git diff --exit-code
```

Then execute the application/browser/container matrix with its prerequisites. Run test-fixture artifact checks after their owning suites. A second independent checkout proves first-install reproducibility. A repeat `npm ci` in the same checkout is an additional regression, not a replacement for either cold check.

For an inconsistent-lock negative case, change a single external dependency version in a scratch manifest without changing the lock; `npm ci` must reject the mismatch. For an internal-range negative case, run the full manifest verifier on a fixture whose consumer range excludes the local version; it must fail without needing the registry. Do not require npm to reject every incompatible internal range: npm may legitimately resolve a registry version, which is why this repository adds its own local-link contract.

An optional LavaMoat duplicate-instance/topology probe is outside the required npm-workspaces migration gates; do not add it to the required command sequence above. If executed, record its command, tested commit, resolved package paths, whether duplicate identity occurred, and whether the result differs from the historical Lerna/bootstrap behavior. Classify it as informational evidence.

## 7. Containers, readiness, and publication boundaries

Node/API readiness: HTTP 200 from `/api/status/enabled-chains`, with an array matching the isolated fixture configuration. The route is in `bitcore-node/src/routes/status.ts` and mounts under `/api`.

BWS HTTP readiness: HTTP 200 from `/bws/api/v1/version/`, with `serviceVersion`, under the default base path. Also inspect the required worker processes/logs because the existing Docker shell tails log files even if a worker exits. Use bounded retries and capture logs on timeout; endpoint response alone does not establish chain synchronization.

Pass the actual host DB port to client tests. Root CI maps MongoDB to 7357 while client defaults to 27017 unless `DB_PORT` is set. Use the existing test configuration; do not edit a personal `bitcore.config.json` for acceptance. Keep one isolated database/Compose namespace per concurrently running test group.

Migrate RPC Docker build contexts before considering its test job GREEN. Keep the separate missing-`migrate` start-service defect outside that gate. Likewise, validate packed consumers without invoking existing `pub` scripts; those scripts publish to npm. Use explicit `npm pack --workspace=<name> --pack-destination=<absolute-temp-directory> --json` after required builds and inspect the returned tarball paths. Pack only explicit non-private candidates. Do not run `npm publish`, `lerna publish`, `npm version`, or tag mutation as acceptance.

`npm run artifacts:check [-- --destination=<absolute-temp-directory>]` (`scripts/workspaces/pack.cjs`) implements the paragraph above for all 17 non-private packages: it re-asserts `packages/pub`'s recorded selection/order and each candidate's manifest against `scripts/workspaces/release-baseline.json`, runs each candidate's own build/lint prerequisite the recorded release scripts actually need (`npm pack` alone does not run a package's `build`/`compile`), packs, and checks the extracted tarball's manifest and file contents. It also runs `scripts/workspaces/audit-packed.cjs` per package -- a static scan of that package's own implementation tree for non-relative imports missing from its own declared dependencies, independent of whatever the eventual validation consumer happens to hoist -- against a small, explicitly named set of documented pre-existing baseline exceptions (mirroring the engines verifier's `socks5-client` exception), not a general suppression mechanism. It writes `artifacts.json` (name/version/tarball path per package) into the destination directory. `npm run artifacts:consumer -- --artifacts=<destination>/artifacts.json [--destination=<absolute-temp-directory>]` (`scripts/workspaces/verify-consumer.cjs`) then installs every one of those tarballs together into one disposable npm project outside the checkout, confirms each installed package is the real extracted tarball at its candidate version (not a registry substitute or a symlink back into the checkout), type-checks a small consumer against wallet-client's shipped declarations with the repository's own `tsc` and `skipLibCheck: false`, and exercises a representative public API (`Key`) plus an ESM import of crypto-rpc's named export on the supported Node 24 toolchain. Neither command ever calls `npm publish`, `npm version`, or a package's own `pub` script.

The own-dependency auditor's only declaration exceptions are `@bitpay-labs/bitcore-wallet-service::ts_build/src/lib/chain/eth/index.d.ts::src` and `@bitpay-labs/bitcore-wallet-service::ts_build/src/lib/chain/xrp/index.d.ts::src`: inherited bare `src/lib/...` aliases emitted into those declarations. They do not waive consumer declaration checking or permit other undeclared imports. The recorded release selection preserves the inherited duplicate P2P Doge entry and omissions; changing release policy is separate work. Release-loop fixtures use a stub npm and must never invoke real publication.

## 8. Evidence and completion

Each evidence record contains task/check ID, source commit, cwd, OS/architecture, Node/npm, argv, prerequisite state, exit code, outcome, and log path. Use `PASS`, `EXPECTED_RED`, `FAIL`, or `BLOCKED`; list out-of-scope baseline defects separately rather than treating them as passes.

Validate runtime/manifest/lock structure before installing; validate engines, local resolution, and build outputs after installation; run application/browser/container and distribution checks with their prerequisites afterward. Synthetic orchestration fixtures supplement the real install/link/build gates. Migration completion requires all integrated gates, with logs for the exact final candidate rather than only an earlier intermediate checkout. Historical plans, task records, and local logs are not prerequisites for using the tracked implementation; keep execution evidence in ignored local artifacts.
