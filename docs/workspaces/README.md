# Workspace maintenance

The root [development guide](../../README.md#development) covers everyday install,
compile, and test commands. This directory retains the workspace execution
contracts and the rationale needed to maintain the implementation:

- [Acceptance specification](acceptance-spec.md): membership, lifecycle order,
  runtime policy, verifier behavior, cold-install acceptance, containers, and
  distribution boundaries.
- [Typing debt](typing-debt.md): the removed Sinon shims, current package-level
  types, and remaining request-mock assertions, with completion criteria.

These documents define contracts and follow-up scope. They are not a claim that
every application, platform, CI, or distribution gate has passed.

## Tooling and checks

Use Node **24.22.1** and npm **11.19.1**, matching root `packageManager` and the
runtime preflight. From the repository root, before an initial install:

```sh
node scripts/workspaces/check-runtime.cjs
node scripts/workspaces/verify.cjs manifests --structure-only
node scripts/workspaces/verify.cjs lock
npm ci --foreground-scripts
```

Normal installation runs the engine verifier and the ordered seven-package
compile. After installation:

```sh
node scripts/workspaces/verify.cjs manifests
node scripts/workspaces/verify.cjs engines
node scripts/workspaces/verify.cjs links
node scripts/workspaces/verify.cjs artifacts --stage=build
npm ls --workspaces --depth=0
node --test test/workspaces/*.test.cjs
```

The 18 backend workspaces share the root lock. Insight and the library benchmark
retain their independent locks. Change membership, runtime requirements, root
wrappers, or compile order together with `scripts/workspaces/lib/constants.cjs`,
the enforcing entry points, and the relevant fixtures. Keep CI, Docker pins, and
developer documentation consistent when changing the supported toolchain.

`scripts/workspaces` and `test/workspaces` are maintained implementation and tests.
Keep them tracked, including new files. Synthetic runner fixtures exercise order,
failure, and signal propagation without depending on application infrastructure;
they supplement cold installs and real package acceptance.

## Shared tool resolution

`bitcore-build` resolves build and test tools from its own package location using
their manifest/bin metadata. Avoid fixed-depth paths to a consumer's nested
`node_modules`: npm can hoist tools to the root or retain nested versions.
The existing focused fixtures cover hoisted, standalone, and space-containing
checkout paths, real browser bundle generation/discovery, and test failure
propagation:

```sh
node --test packages/bitcore-build/test/tool-resolution.test.cjs
```

## Distribution checks

Use `npm run artifacts:check -- --destination=<absolute-directory>` to compile,
prepare, pack, and audit all 17 public packages. Then run
`npm run artifacts:consumer -- --artifacts=<absolute-directory>/artifacts.json`
to validate the resulting tarballs in an external consumer. See acceptance
specification section 7 for the exact checks and narrowly named baseline
exceptions. Package preparation can run full suites and needs their prerequisites;
build-artifact presence alone does not establish distribution acceptance.

These checks use `npm pack`. Existing `pub` scripts perform actual publication
and are not acceptance commands. The release baseline records the inherited
selection/order separately from the complete public-package validation set.

## Evidence

Keep execution logs, task records, and working plans outside the tracked source.
`artifacts/workspaces` is ignored for local evidence; IDE planning files stay
ignored as well. No tool depends on those local records. Bind acceptance evidence
to a source SHA (and any uncommitted changes), root-lock hash, Node/npm pair,
OS/architecture, commands, exit codes, prerequisites, and log paths.
