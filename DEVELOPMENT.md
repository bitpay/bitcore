# Bitcore Development Setup

## Overview

This repository uses LavaMoat `allow-scripts` to prevent dependency lifecycle scripts from executing automatically during installation.

The repository-level `.npmrc` contains:

```ini
ignore-scripts=true
```

As a result, running `npm ci` by itself installs only the root dependency tree. It does not:

* run the former root `postinstall` workflow;
* bootstrap the Lerna-managed child packages;
* execute approved dependency lifecycle scripts;
* compile the monorepo.

Use the repository setup command instead:

```sh
npm run setup
```

This is the supported command for preparing a fresh local checkout.

## Prerequisites

Use the repository-supported versions of:

* Node.js
* npm
* Python, where required by legacy build tooling
* Docker, where required by package tests or runtime services

CircleCI currently uses Node.js `22.13.1` and npm `10.9.2`.

Confirm your local versions with:

```sh
node --version
npm --version
```

## Initial setup

From the repository root, run:

```sh
npm run setup
```

The setup command performs the following stages:

1. Install root dependencies without running lifecycle scripts.
2. Bootstrap all Lerna-managed child dependency trees while lifecycle scripts remain disabled.
3. Validate each child package's committed LavaMoat policy.
4. Plan a deduplicated, fail-closed approved lifecycle execution.
5. Execute only the dependency lifecycle scripts explicitly approved by those policies.
6. Compile the monorepo in its required dependency order.

The root scripts are:

```json
{
  "setup": "npm ci --ignore-scripts && npm run setup:installed",
  "setup:installed": "npm run bootstrap:inert && npm run lifecycle:approved && npm run compile",
  "bootstrap:inert": "npm_config_ignore_scripts=true lerna bootstrap",
  "lifecycle:approved": "./validate-and-run-allowed-scripts.sh"
}
```

## Why `npm ci` is not enough

Historically, the root `postinstall` script automatically bootstrapped and compiled the repository after installation.

That behavior is intentionally no longer tied to npm's automatic lifecycle execution. npm's `ignore-scripts=true` setting disables both untrusted dependency lifecycle scripts and first-party lifecycle hooks such as `postinstall`.

There is no npm setting that means:

> Disable all dependency lifecycle scripts, but automatically run only this repository's root `postinstall`.

Instead, the repository explicitly separates installation, approved dependency execution, and trusted first-party build commands.

Therefore:

```sh
npm ci --ignore-scripts
```

means:

> Install the root dependency tree inertly.

Whereas:

```sh
npm run setup
```

means:

> Fully prepare the Bitcore monorepo for development.

## Setup stages

### Root installation

The first stage is:

```sh
npm ci --ignore-scripts
```

The command-line option is deliberate. The committed `.npmrc` provides a safe
default, while `--ignore-scripts` prevents an ambient setting such as
`npm_config_ignore_scripts=false` from re-enabling dependency lifecycle scripts
inside the setup workflow.

The intentionally hostile test package `@lavamoat/preinstall-always-fail` must remain denied. A successful inert installation proves that npm did not execute its lifecycle script.

### Inert child bootstrap

The next stage is:

```sh
npm run bootstrap:inert
```

This expands to:

```sh
npm_config_ignore_scripts=true lerna bootstrap
```

The explicit environment variable is required.

The root `.npmrc` protects npm commands run from the repository root, but legacy Lerna invokes npm from child-package working directories. Those child npm processes do not reliably inherit the root `.npmrc`.

Setting `npm_config_ignore_scripts=true` explicitly ensures lifecycle scripts remain disabled while all managed child dependency trees are installed.

Do not run an unguarded command such as:

```sh
lerna bootstrap
```

or:

```sh
npm run bootstrap
```

The repository intentionally does not expose an unguarded `bootstrap` npm script.

### LavaMoat policy validation

After bootstrap, the repository runs:

```sh
npm run lifecycle:approved
```

The underlying script first runs `allow-scripts check` from each Lerna-managed child package directory.

Each package has its own:

* dependency tree;
* `package.json`;
* `lavamoat.allowScripts` policy;
* path-sensitive lifecycle dependency inventory.

The current working directory determines which package policy `allow-scripts` inspects.

The validation phase checks all 18 managed packages. It collects and reports all package-policy failures before terminating. Approved lifecycle scripts are not executed unless every package policy passes validation.

A validation failure generally means one of the following:

* a dependency with a lifecycle script was added but is not represented in policy;
* a dependency path or version changed;
* a committed policy entry no longer matches an installed dependency;
* the package lockfile and policy are out of sync.

Do not bypass this failure by automatically approving new entries.

Review the new lifecycle dependency, determine whether its script is necessary, and update policy only after completing the appropriate security and functional review.

### Approved lifecycle execution planning

After every policy passes, the runner builds a complete execution plan before
running any lifecycle script.

For each package, the planner:

* rejects top-level `install`, `postinstall`, `prepublish`, and `prepare` hooks,
  because `allow-scripts run` would execute those hooks outside
  `lavamoat.allowScripts`;
* rejects a top-level `binding.gyp`, because npm would synthesize an implicit
  `node-gyp rebuild` install hook;
* resolves every approved dependency to its physical filesystem path;
* schedules a physical dependency tree only once when Lerna symlinks make it
  visible through multiple package policies;
* rejects a package whose approvals only partially overlap an earlier
  package's approvals, because invoking `allow-scripts run` would repeat the
  overlapping lifecycle scripts.

Planning failures are collected before execution begins. This preserves the
all-or-nothing validation boundary.

Trusted first-party setup work belongs in an explicit root npm script, not in a
workspace lifecycle hook.

### Approved dependency lifecycle execution

Once validation and planning succeed, the runner invokes:

```sh
allow-scripts run
```

only from package directories with newly scheduled approved dependency paths.

Only dependency lifecycle paths explicitly set to `true` are allowed to execute.

The current approved policies are narrowly limited to the required
`bcrypt#5.1.0` installation visible from:

* `@bitpay-labs/bitcore-client`;
* `@bitpay-labs/bitcore-client` linked beneath `@bitpay-labs/bitcore-node`.

Lerna resolves both policy paths to the same physical `bcrypt` directory, so
the planner executes its install script once.

All other reviewed lifecycle dependencies remain denied.

The lifecycle runner stops immediately if an approved script fails.

The repository uses the locally installed executable:

```sh
node_modules/.bin/allow-scripts
```

Do not use an unrestricted `npx allow-scripts` command, because it may download or execute a package version other than the one committed to this repository.

### Ordered monorepo compilation

The final setup stage is:

```sh
npm run compile
```

Compilation must occur in the committed four-stage order:

```json
{
  "compile": "npm run compile:bitcore-node-prereqs && npm run compile:bitcore-node-prod && npm run compile:remaining && npm run compile:bitcore-node",
  "compile:bitcore-node-prereqs": "npm --prefix packages/bitcore-logging run compile && npm --prefix packages/crypto-wallet-core run compile",
  "compile:bitcore-node-prod": "npm --prefix packages/bitcore-node run clean && npm --prefix packages/bitcore-node run build:prod",
  "compile:remaining": "lerna run compile --ignore @bitpay-labs/bitcore-node --ignore @bitpay-labs/bitcore-logging --ignore @bitpay-labs/crypto-wallet-core",
  "compile:bitcore-node": "lerna run compile --scope @bitpay-labs/bitcore-node"
}
```

The ordering is significant.

First, `bitcore-logging` and `crypto-wallet-core` are compiled because later packages require their generated output.

Next, the production build for `bitcore-node` runs before the wider Lerna compilation.

The remaining compilable packages then run, excluding packages already handled separately.

Finally, `bitcore-node` runs its normal compile after its dependencies and related packages are ready.

Do not replace this sequence with a single unordered:

```sh
lerna run compile
```

The repository contains dependency-order and circularity constraints that the four-stage sequence resolves.

## Subsequent development

After the repository has been successfully prepared, it is not necessary to run a complete installation before every code change.

To recompile:

```sh
npm run compile
```

To run a package-specific test suite, use the corresponding root script. For example:

```sh
npm run test:bitcore-client
npm run test:crypto-wallet-core
npm run test:bitcore-node
```

To start Bitcore Node:

```sh
npm run node
```

To start Bitcore Wallet Service:

```sh
npm run bws
```

## Clean setup

Use a clean setup when:

* dependency manifests or lockfiles change;
* LavaMoat policies change;
* native artifacts may be stale;
* lifecycle scripts have been run manually;
* switching between branches with dependency changes;
* diagnosing a setup or native-module failure.

Remove all installed dependency trees:

```sh
rm -rf node_modules

find packages \
  -type d \
  -name node_modules \
  -prune \
  -exec rm -rf {} +
```

Then run:

```sh
npm run setup
```

## Dependency changes

When adding, removing, or updating a dependency:

1. Update the appropriate package manifest and lockfile.
2. Perform an inert installation or bootstrap.
3. Run the package's `allow-scripts list` and `allow-scripts check`.
4. Review any new or changed lifecycle dependency paths.
5. Keep new entries denied unless real Bitcore build, test, runtime, or CLI behavior proves that the lifecycle-produced artifact is required.
6. Approve one exact path-sensitive key at a time.
7. Rerun the failing first-party behavior.
8. Reproduce the result from a clean installation.
9. Confirm platform-dependent results in Linux CI.

### Policy versioning

Use a hybrid versioning policy for `lavamoat.allowScripts`:

* Entries set to `true` must include the exact reviewed dependency version.
* Entries set to `false` may omit the final `#version` suffix.

For example:

```json
{
  "lavamoat": {
    "allowScripts": {
      "secp256k1": false,
      "@bitpay-labs/crypto-wallet-core>tiny-secp256k1": false,
      "bcrypt#5.1.0": true,
      "@bitpay-labs/bitcore-client>bcrypt#5.1.0": true
    }
  }
}
```

A versionless denied entry remains denied when that dependency is upgraded,
which reduces policy churn. It applies only to the same path-sensitive
dependency name; a new package or dependency path remains unconfigured and
causes validation to fail.

An approved entry remains version-pinned so an unreviewed future release cannot
inherit permission to execute lifecycle code.

Do not use `--skip-versions` with `allow-scripts auto`, `check`, or `run`.
That option changes version matching globally, including approved entries, and
using it for configuration but not execution creates incompatible policies.
Convert existing denied entries to versionless keys as a deliberate,
reviewable manifest change while leaving every approved entry pinned.

Do not run repository-wide:

```sh
allow-scripts auto
```

as a substitute for review.

Do not approve lifecycle scripts merely because a package declares one or because installation reports an unconfigured entry.

## `packages/insight`

`packages/insight` is intentionally excluded from Lerna package discovery by `lerna.json`.

Therefore, the standard setup workflow does not:

* install Insight dependencies;
* inspect an Insight LavaMoat policy;
* execute Insight dependency lifecycle scripts;
* compile Insight.

The existing `insight:build` command is a separate workflow and is not covered by the reviewed LavaMoat setup process.

Treat changes to that workflow separately.

## CI and Docker parity

CircleCI uses the same repository-owned setup command as local development:

```sh
npm run setup
```

This ensures that local and CI setup use the same:

* inert root installation;
* guarded Lerna bootstrap;
* package-policy validation;
* approved lifecycle execution;
* compilation ordering.

CircleCI remains responsible for environment-specific orchestration, including:

* selecting Node and Python versions;
* restoring and saving caches;
* persisting workspaces;
* starting service containers;
* collecting artifacts and coverage;
* running downstream jobs.

Repository setup behavior belongs in version-controlled npm and shell scripts rather than being reimplemented in CircleCI YAML.

The Bitcore Node and Bitcore Wallet Service Dockerfiles install the root tree
with `npm ci --ignore-scripts`, copy the lifecycle runner and planner, and then
run:

```sh
npm run setup:installed
```

This avoids a second root installation inside the image while preserving the
same inert bootstrap, lifecycle validation, deduplicated execution, and ordered
compilation.

## Troubleshooting

### `allow-scripts - allowlist needs update`

Run the lifecycle command to identify every failing package:

```sh
npm run lifecycle:approved
```

The validation phase will print the current lifecycle inventory for each package whose policy does not match its installed tree.

Review the dependency change rather than immediately approving it.

### Lifecycle execution planning fails

Do not bypass planning failures by invoking `allow-scripts run` manually.

If a workspace defines a top-level lifecycle hook, move that trusted operation
to an explicit root setup script.

If approved dependency paths overlap, review their real paths and policies.
The runner safely skips complete overlaps, but rejects partial overlaps because
the `allow-scripts` CLI cannot execute only the non-overlapping subset.

### Missing `bcrypt_lib.node`

This indicates that the approved `bcrypt#5.1.0` lifecycle script did not run successfully for the affected package tree.

Run:

```sh
npm run lifecycle:approved
```

Then confirm the generated native binding exists:

```sh
find packages \
  -path '*/node_modules/bcrypt/lib/binding/*/bcrypt_lib.node' \
  -print
```

### Package compilation fails because generated sibling output is missing

Run the complete ordered compile:

```sh
npm run compile
```

Do not replace it with an unordered Lerna compile.

### Local checkout appears partially installed

Remove root and child `node_modules` directories and rerun:

```sh
npm run setup
```

### Shell script reports `Permission denied`

Confirm the lifecycle runner is executable:

```sh
ls -l validate-and-run-allowed-scripts.sh
git ls-files -s validate-and-run-allowed-scripts.sh
```

The Git mode should be:

```text
100755
```

## Security summary

The setup model is:

```text
Install code with an explicit dependency-lifecycle-script prohibition
→ validate committed path-sensitive policies
→ reject implicit workspace hooks and deduplicate physical dependency paths
→ execute only reviewed dependency lifecycle scripts
→ execute trusted first-party bootstrap and build commands explicitly
```

LavaMoat does not prevent the repository from bootstrapping or compiling.

It prevents dependency installation from silently deciding which executable code is allowed to run.
