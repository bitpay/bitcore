#!/usr/bin/env node
'use strict';

// Audit each package against its own runtime declarations, never the set of
// modules that happen to be hoisted in the combined consumer.
const fs = require('node:fs');
const { builtinModules } = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const builtins = new Set(builtinModules.map(n => n.replace(/^node:/, '')));

// Documented pre-existing baseline defect, not introduced by this migration:
// wallet-service's tsconfig sets `baseUrl: "."`, so its eth/xrp chain source
// resolves a bare `src/lib/...` specifier locally inside this monorepo, but
// tsc emits that same literal specifier into the shipped .d.ts, where it
// cannot resolve for an external consumer type-checking against the
// published declarations. The real fix means editing that TypeScript
// source, which is outside this migration's packaging-only scope; it is named explicitly here, the same as
// the engines verifier's socks5-client exception, so a real regression
// elsewhere is never silently masked by broadening this list.
const DOCUMENTED_BASELINE_EXCEPTIONS = new Set([
  '@bitpay-labs/bitcore-wallet-service::ts_build/src/lib/chain/eth/index.d.ts::src',
  '@bitpay-labs/bitcore-wallet-service::ts_build/src/lib/chain/xrp/index.d.ts::src',
]);

function audit(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json')));
  const declared = { ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies };
  const failures = [];
  const exceptions = [];
  const imports = [];
  function walkFile(dir, name) {
    const file = path.join(dir, name);
    const relative = path.relative(directory, file);
    // Runtime code and public declarations; source TS is superseded by its emitted JS.
    if (!/\.(?:c?js|mjs|d\.ts)$/.test(file) || /(?:gulpfile|\.config\.|\.conf\.|\.min\.js$|^bitcore-[^/]+\.js$|^tests\.js$)/.test(relative)) return;
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) specifier = node.arguments[0];
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
      if (specifier && ts.isStringLiteral(specifier)) {
        const spec = specifier.text;
        if (!spec.startsWith('.') && !spec.startsWith('/') && !builtins.has(spec.replace(/^node:/, ''))) {
          const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
          imports.push({ file: relative, name });
          if (name !== manifest.name && !declared[name]) {
            const failure = `${manifest.name}: ${relative} imports undeclared runtime dependency ${name}`;
            if (DOCUMENTED_BASELINE_EXCEPTIONS.has(`${manifest.name}::${relative}::${name}`)) exceptions.push(failure);
            else failures.push(failure);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!['node_modules', 'test', 'tests', 'coverage', 'docs', 'example', 'examples', 'benchmark', 'blockchain'].includes(entry.name)) walk(path.join(dir, entry.name));
        continue;
      }
      walkFile(dir, entry.name);
    }
  }
  // Limit to public implementation trees plus root entry/config JS. Manual
  // administration scripts and uncompiled TS are not library runtime roots.
  // Several packages (bitcore-lib, bitcore-p2p*, bitcore-mnemonic, crypto-rpc,
  // bitcore-build) declare their `main` directly at the package root rather
  // than inside one of those subdirectories, so the root's own top-level
  // files are scanned too -- but not recursively, so unrelated top-level
  // trees (e.g. bitcore-lib's leftover `karma-wdio-mig-TMP/`) are never
  // walked into.
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (['lib', 'ts_build', 'build', 'ecdsa', 'ecies'].includes(entry.name)) walk(path.join(directory, entry.name));
      continue;
    }
    walkFile(directory, entry.name);
  }
  return {
    name: manifest.name,
    imports,
    failures: [...new Set(failures)],
    exceptions: [...new Set(exceptions)],
  };
}
module.exports = { audit, DOCUMENTED_BASELINE_EXCEPTIONS };
if (require.main === module) {
  const results = process.argv.slice(2).map(audit);
  console.log(JSON.stringify(results, null, 2));
  if (results.some(r => r.failures.length)) process.exitCode = 1;
}
