# LavaMoat Node Runtime Assessment for Bitcore

**Assessment date:** July 30, 2026  
**Scope:** LavaMoat runtime compatibility for Bitcore Node (BCN) and other executable packages in this repository

## Executive summary

Bitcore is predominantly CommonJS at runtime, but its production dependency graph is not CommonJS-only.

The legacy `lavamoat` Node runtime cannot currently protect BCN because BCN loads `@bitpay-labs/crypto-rpc`, which is a native ECMAScript module (ESM). The legacy runtime implements a custom CommonJS loader and explicitly does not support ESM anywhere in the reachable module graph.

The newer `@lavamoat/node` runtime is intended to replace the legacy runtime and supports ESM. It is the appropriate candidate for BCN, but LavaMoat currently describes it as alpha-quality, so it should be evaluated through a focused proof of concept before adoption.

## What the LavaMoat runtime does

LavaMoat provides runtime protection for a Node.js process and the packages loaded into that process. It is designed to limit the impact of a compromised or malicious dependency.

For each package, a LavaMoat policy controls access to capabilities such as:

- Other packages it may load
- Node built-ins such as `fs`, `net`, `crypto`, and `child_process`
- Globals such as `process`, `Buffer`, and timers
- Native modules and other privileged resources

Packages execute in separate Secure ECMAScript (SES) compartments. JavaScript intrinsics are hardened to prevent packages from modifying shared prototypes, and resources not granted by policy are unavailable to the package.

This complements `@lavamoat/allow-scripts`; it does not replace it:

| Protection | When it operates | What it controls |
| --- | --- | --- |
| `allow-scripts` | Dependency installation | Which dependency lifecycle scripts may execute |
| LavaMoat runtime | Application execution | What loaded packages may import and access |

## The unit of protection is a process entry point

LavaMoat is launched around an executable Node.js entry point:

```sh
lavamoat build/src/server.js
```

It then protects the entry point's reachable dependency graph:

```text
BCN process
├── BCN application code
├── @bitpay-labs/crypto-rpc
├── @bitpay-labs/crypto-wallet-core
├── Express
├── MongoDB driver
└── transitive dependencies
```

Library packages do not generally need separate LavaMoat launchers. For example, `crypto-wallet-core` benefits from LavaMoat protection when a protected BCN process loads it. It would need its own launcher and policy only if it also provided an independently executed program.

In this repository, the natural runtime integration points include:

- BCN's main server and its API, P2P, pruning, and other workers
- Bitcore Wallet Service and its independently launched services
- Bitcore CLI
- Administrative, verification, and migration scripts where the additional protection justifies maintaining a policy

Browser code such as Insight is outside the scope of the Node runtime. LavaMoat's browser or bundler integrations would be the corresponding protection there.

Policies should normally be maintained per application or materially different entry point. Similar workers may be able to share a policy, while entry points with significantly different capability requirements are better served by separate policies.

## Current module-format findings

Most Node-oriented TypeScript packages in Bitcore emit CommonJS. BCN is an example:

```json
{
  "compilerOptions": {
    "module": "commonjs"
  }
}
```

See [`packages/bitcore-node/tsconfig.json`](packages/bitcore-node/tsconfig.json).

BCN starts the emitted CommonJS server:

```json
{
  "scripts": {
    "start": "npm run tsc && node build/src/server.js"
  }
}
```

See [`packages/bitcore-node/package.json`](packages/bitcore-node/package.json).

However, `@bitpay-labs/crypto-rpc` is explicitly ESM:

```json
{
  "main": "index.js",
  "type": "module"
}
```

Its entry point uses native ESM exports:

```js
export { CryptoRpc } from './lib/index.js';
export * as utils from './lib/utils.js';
```

See:

- [`packages/crypto-rpc/package.json`](packages/crypto-rpc/package.json)
- [`packages/crypto-rpc/index.js`](packages/crypto-rpc/index.js)

This package is a production dependency of BCN and is imported by BCN runtime code:

- [`packages/bitcore-node/package.json`](packages/bitcore-node/package.json)
- [`packages/bitcore-node/src/providers/chain-state/evm/api/csp.ts`](packages/bitcore-node/src/providers/chain-state/evm/api/csp.ts)
- [`packages/bitcore-node/src/providers/chain-state/svm/api/csp.ts`](packages/bitcore-node/src/providers/chain-state/svm/api/csp.ts)
- [`packages/bitcore-node/src/modules/ripple/api/csp.ts`](packages/bitcore-node/src/modules/ripple/api/csp.ts)

The effective runtime graph therefore contains a CommonJS-to-ESM boundary:

```text
BCN entry point (compiled CommonJS)
└── @bitpay-labs/crypto-rpc (native ESM)
```

Modern Node versions may support loading some synchronous ESM from CommonJS. That capability belongs to Node's native loader and does not add ESM support to the legacy LavaMoat loader.

## Why legacy LavaMoat cannot load ESM

This is an architectural limitation, not a configurable policy restriction.

CommonJS modules are traditionally evaluated in a wrapper similar to:

```js
function (exports, require, module, __filename, __dirname) {
  // Module source
}
```

Legacy LavaMoat replaces Node's normal CommonJS loading machinery. Its loader:

1. Resolves and reads the module.
2. Determines which package owns it.
3. Creates or selects that package's SES compartment.
4. Supplies only the globals and dependencies granted by policy.
5. Evaluates the CommonJS wrapper in the compartment.
6. Provides a policy-aware replacement for `require()`.

This custom loading step is what makes the isolation enforceable. Handing unsupported modules back to Node's unrestricted loader would allow those modules to execute outside the expected compartment and undermine the policy.

ESM requires a different loading and linking model:

- `import` and `export` are parsed as module syntax.
- Dependencies are linked before execution.
- Exports use live bindings instead of a mutable `module.exports` object.
- ESM provides facilities such as `import.meta`.
- Loading can become asynchronous, particularly with top-level `await`.
- Resolution differs from traditional CommonJS resolution.

The legacy LavaMoat loader did not implement that model. Its documentation consequently states that it virtualizes CommonJS loading and does not support ESM modules.

If the legacy runtime encounters reachable ESM, loading fails rather than silently running the package without protection. Depending on where and how the incompatibility is detected, this may happen during policy generation or protected process startup. Typical symptoms include an unsupported-ESM error or a syntax error on `import` or `export`. The ESM module's body generally does not execute.

An ESM package merely being installed is not a problem. The limitation applies when the protected process reaches an ESM entry point or file. A dual-mode package can work if LavaMoat resolves its CommonJS entry point, and unused ESM files do not affect the process.

## Compatibility conclusion

### Legacy `lavamoat`

The legacy runtime is not a viable option for BCN's current production graph because BCN executes code from the ESM-only `crypto-rpc` package.

Using it would require one of the following:

- Convert `crypto-rpc` back to CommonJS.
- Publish and consume a supported CommonJS build of `crypto-rpc`.
- Remove `crypto-rpc` from the protected BCN process.

Even after such a change, the complete reachable dependency graph would need validation for other ESM dependencies and runtime incompatibilities.

The legacy runtime may still be usable for a different process whose reachable graph is entirely CommonJS, but that must be confirmed by generating a policy and exercising the process. It should not be inferred solely from the entry point's file format.

### New `@lavamoat/node`

The newer runtime:

- Is intended to replace legacy `lavamoat`.
- Supports ESM through `@endo/compartment-mapper`.
- Requires Node.js 20.19.0 or newer, which is compatible with BCN's Node 22 target.
- Is currently described by LavaMoat as alpha-quality.
- Does not yet support `await import()` in CommonJS scripts.

No production occurrence of that last pattern was found in the principal CommonJS backend sources during this assessment; an occurrence exists in test code.

## Recommendation

Do not pursue the legacy `lavamoat` runtime for BCN.

If runtime isolation is a current objective, conduct a time-boxed proof of concept with `@lavamoat/node` against one BCN entry point. A useful evaluation would:

1. Install `@lavamoat/node` on a dedicated branch.
2. Generate a policy for `packages/bitcore-node/build/src/server.js`.
3. Review the generated policy and place intentional changes in a policy override.
4. Start BCN under LavaMoat in the same Node 22 environment used for deployment.
5. Exercise representative BTC, EVM, SVM, and XRP paths so that `crypto-rpc` and native dependencies are covered.
6. Run relevant integration tests and observe worker startup, database access, network access, native modules, and shutdown behavior.
7. Record required overrides, unsupported behavior, startup overhead, and policy-maintenance cost.
8. Decide whether alpha-runtime risk and ongoing policy maintenance are acceptable for production.

A smaller proof of concept against Bitcore Wallet Service could help establish operational familiarity, but it would not prove BCN compatibility because the two processes have different dependency graphs and capability requirements.

## References

- [LavaMoat Node.js runtime guide](https://lavamoat.github.io/guides/lavamoat-node/)
- [`@lavamoat/node` README](https://github.com/LavaMoat/LavaMoat/tree/main/packages/node#readme)
- [LavaMoat policy documentation](https://lavamoat.github.io/guides/policy/)
- [LavaMoat runtime overview](https://lavamoat.github.io/about/runtime-environment/)
