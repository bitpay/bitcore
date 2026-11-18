# Insight

**Insight Blockchain Explorer.**

Insight is kept out of the Bitcore monorepo's npm workspace graph on purpose:
it has its own React/TypeScript toolchain and its own independent lockfile,
separate from the backend packages under `packages/`.

## Get Started

From the repo root:

```sh
npm run insight:install
npm run insight:build
```

Or, working inside this directory directly (its own install, opted out of
the root workspace):

```sh
npm ci --workspaces=false
npm run start   # dev server
npm run build   # production build
```
