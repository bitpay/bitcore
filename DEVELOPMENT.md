# Bitcore development setup

## Prerequisites

CircleCI uses Node.js 22.13.1 and npm 10.9.2. Use those versions locally.
Some package workflows also require Python or Docker.

## Set up a checkout

From the repository root, run:

```sh
npm run setup
```

This is the supported setup command locally and in CI. It:

1. Runs `npm ci --ignore-scripts` for the root dependency tree.
2. Runs `lerna bootstrap --ci --concurrency 1 --ignore-scripts` to install and
   link managed packages without lifecycle scripts.
3. Validates every managed package's committed LavaMoat policy before any
   approved dependency script can run.
4. Runs `allow-scripts` in each managed package, executing only approved
   dependency lifecycle scripts.
5. Compiles the monorepo in its required order while automatic `pre*` and
   `post*` companions remain disabled.

The root `.npmrc` sets `ignore-scripts=true`, and setup also passes the option
explicitly. Lerna's `--ci` option gives local and CI bootstrap the same clean,
lockfile-based behavior. Bootstrap is serialized because parallel fresh Lerna
installs were observed to omit dependency files on macOS.

`npm ci` alone installs only the root dependencies; it does not bootstrap or
compile the monorepo. Do not replace `npm run setup` with a bare
`lerna bootstrap`.

## Compile and run

After setup, recompile with:

```sh
npm run compile
```

Use this command instead of calling `lerna run compile` directly. It explicitly:

1. Compiles `bitcore-logging` and `crypto-wallet-core` prerequisites.
2. Runs the `bitcore-node` production build formerly triggered by
   `bitcore-client`'s suppressed `precompile` hook.
3. Uses Lerna to compile the remaining packages in dependency order.
4. Compiles `bitcore-node` normally after its dependencies.
5. Creates the `bitcore-cli` executable link formerly created by its suppressed
   `postbuild` hook.

The compile scripts pass `--ignore-scripts` or
`npm_config_ignore_scripts=true`, so explicitly requested scripts run without
automatically invoking their `pre*` or `post*` companions.

Common commands include:

```sh
npm run test:bitcore-client
npm run test:crypto-wallet-core
npm run test:bitcore-node
npm run node
npm run bws
```

## Dependency lifecycle policy

Each managed package has a path-sensitive `lavamoat.allowScripts` policy:

- Versionless `false` entries deny a dependency script by default, including
  after dependency upgrades.
- Exact, versioned `true` entries approve only the reviewed release.

The only current approval is `bcrypt#5.1.0` in
`@bitpay-labs/bitcore-client`. Bitcore Node reaches the same physical dependency
through Lerna's link to `bitcore-client`, so its nested policy denies the script
instead of executing it again.

Before `allow-scripts run`, `npm run allow-scripts:validate` fails if any managed
package has:

- a missing dependency policy;
- a non-boolean decision;
- a `true` approval that isn't versioned, or an inactive approval;
- a top-level `preinstall`, `install`, `postinstall`, `prepublish`, or `prepare`
  hook;
- a top-level `binding.gyp`, which implies an install hook.

Inactive denials are accepted because platform-specific dependencies may be
absent. Inactive approvals are rejected. No approved dependency script runs
unless validation succeeds for every managed package.

The root dependency `@lavamoat/preinstall-always-fail` is an installation
canary: setup succeeds only while the root install remains inert. Keep trusted
first-party setup work in explicitly named root scripts, not workspace install
hooks.

> **Warning: package-level lifecycle scripts run unconditionally when
> `allowScripts` is configured.** If a managed package has any
> `lavamoat.allowScripts` entries, `allow-scripts run` will also execute that
> package's own `install`, `postinstall`, `prepublish`, and `prepare` hooks —
> regardless of whether those hooks appear in the `allowScripts` policy.
> The policy only gates *dependency* lifecycle scripts. This is by design in
> LavaMoat, but it means adding a top-level lifecycle script to a package with
> an active `allowScripts` config will cause that script to execute during
> `npm run setup`. Validate the intended behavior before adding such hooks.

## Update dependencies

When adding or updating a dependency:

1. Update its manifest and lockfile.
2. Install without lifecycle scripts:

   ```sh
   npm ci --ignore-scripts
   npm run bootstrap:inert
   ```

3. Populate new lifecycle paths as versionless denials:

   ```sh
   npm run allow-scripts:config
   ```

4. Review every policy change. Approve a script only when Bitcore requires its
   generated artifact, and use an exact versioned `true` entry.
5. Run `npm run allow-scripts:validate`.
6. Run `npm run setup` from clean dependency trees and confirm Linux CI.

`allow-scripts:config` uses Lerna to inspect every managed dependency tree with
the root-locked executable. It does not use `npx` or approve scripts
automatically. Always review the manifest changes it produces.

## CI, Docker, and Insight

CircleCI runs `npm run setup`. Dockerfiles split the equivalent flow into:

```sh
npm ci --ignore-scripts
npm run setup:installed
```

`setup:installed` assumes root dependencies are already installed; developers
should normally use `npm run setup`.

`packages/insight` is excluded by `lerna.json`, so standard setup does not
install, inspect, or compile it. Use `npm run insight:build` for that separate
package.

## Troubleshooting

- Unconfigured dependency: run `npm run allow-scripts:config`, review the new
  denial, and rerun setup. Do not approve it without reviewing its script.
- Forbidden workspace hook: move trusted work to an explicit root setup or
  compile script; do not bypass validation.
- Missing `bcrypt` native binding: rerun setup. If the version changed, review
  the new release before updating the pinned approval.
- Missing generated output after dependency or branch changes: remove the root
  and package `node_modules` directories, then run `npm run setup`.
