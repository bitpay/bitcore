# Why this directory has its own `package.json`

This is **not** a published or workspace package. The `package.json` here exists
solely to give this directory its own Node package boundary, with `"type":
"module"` matching the parent package's ESM type. It has no dependencies,
scripts, or entry point.

## The problem it fixes

Hardhat locates its project by walking up from `process.cwd()` looking for
`hardhat.config.js`. The `hardhat:compile` script in `packages/crypto-rpc` runs
`cd blockchain/EVM/ && npx hardhat compile`, so Hardhat's detection depends on
`npx`'s child process inheriting this directory as its cwd.

Under npm workspaces, when `hardhat` is hoisted to the monorepo root (as it
is now that crypto-rpc's Dockerfiles install from root), `npx` invoked from a
subdirectory that has **no `package.json` of its own** silently resets the
child process's cwd to the nearest ancestor `package.json` — here, the
crypto-rpc package root. Hardhat then can't find `hardhat.config.js` and
fails with:

```
HardhatError: HH1: You are not inside a Hardhat project
```

Running the direct binary (`node_modules/.bin/hardhat compile`) from the same
directory succeeds, which is what pointed the diagnosis at `npx` itself.

## Why it's npm-workspaces-specific

Confirmed against the same npm version (10.9.2) in two disposable fixtures:

- A plain (non-workspaces) npm project preserves the real cwd from a
  package-less subdirectory.
- A minimal npm-workspaces fixture (root `"workspaces": ["packages/foo"]`,
  `packages/foo/sub` with no `package.json`) reproduces the identical
  cwd-reset to `packages/foo`.

It does not manifest on `master`, which has no `workspaces` field at all
(Lerna-based) and a standalone per-package `hardhat` install nested under
`packages/crypto-rpc/node_modules`.

## Reproduction

Minimal, no Docker/Hardhat needed: create a root `package.json` with a
`workspaces` array naming one member package, put a sub-directory with no
`package.json` of its own inside that member, then run

```sh
npx node -e "console.log(process.cwd())"
```

from that sub-directory — it prints the member package's root, not the real
cwd.

Full in-repo reproduction (requires this branch with the fix removed):

```sh
rm packages/crypto-rpc/blockchain/EVM/package.json
docker build --no-cache -t crypto-rpc-npx-bug -f packages/crypto-rpc/test/docker/Dockerfile-test .
docker run --rm --entrypoint sh crypto-rpc-npx-bug -c 'cd blockchain/EVM && npx hardhat compile'
git checkout -- packages/crypto-rpc/blockchain/EVM/package.json
```

Expected: `HardhatError: HH1: You are not inside a Hardhat project`.
