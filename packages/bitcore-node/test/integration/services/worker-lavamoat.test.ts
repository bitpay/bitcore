import { expect } from 'chai';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';

// Tier-1 test for the effort to propagate LavaMoat protection across
// bitcore-node's cluster-forked workers. This targets the real production
// entry point (build/src/workers/api.js), not a synthetic stand-in -- its
// job is to drive and then guard the extraction/wiring steps that follow.
//
// This observes the worker's SES-lockdown state through a permanent,
// always-on log line (see the `LAVAMOAT_WORKER_SES_SIGNAL` logger.info call
// in src/workers/api.ts's worker branch) rather than a test-only IPC
// channel: a cluster.fork()ed worker's stdout is inherited by the primary
// by default (confirmed empirically), so the primary's own captured stdout
// already contains whatever the worker logs, with no relay code needed. An
// earlier version of this test used a `LAVAMOAT_SIGNAL_TEST` CLI flag and a
// custom IPC message purpose-built for this test; that was reverted after
// review flagged it as production plumbing that would be dead code the
// moment this test file was removed.
//
// Today, this is expected to fail as a TIMEOUT, not a clean `false` signal.
// Confirmed by actually running it: with no generated policy yet at
// lavamoat/node/policy-api.json (that comes later), the primary process
// itself crashes during module load -- on `require('source-map-support/
// register')`, denied by the empty fallback policy -- before it ever
// reaches the cluster.isPrimary branch, let alone forks a worker. No
// worker process exists yet to log the SES signal at all, so it never
// appears in stdout. That's still the correct red state for TDD purposes,
// just for a more specific reason than "the hook is missing" -- the hook
// is present and unconditional; the primary just doesn't survive long
// enough to reach the code path that would exercise it.
describe('LavaMoat protection propagates to cluster-forked workers', function() {
  this.timeout(30000);

  // __dirname at runtime is build/test/integration/services -- tsc's rootDir
  // covers src/, scripts/, and test/ as siblings under the package root, so
  // build/ mirrors that whole layout (not just build/src). FOUR levels up
  // reaches the package root (services -> integration -> test -> build ->
  // package root), not three. Verified against the real build; do not trust
  // this arithmetic without re-checking if the test ever moves.
  const projectRoot = path.resolve(__dirname, '../../../..');
  const lavamoatBin = path.resolve(projectRoot, 'node_modules/.bin/lavamoat');
  const entry = path.resolve(projectRoot, 'build/src/workers/api.js');

  let child: ChildProcess | undefined;

  afterEach(() => {
    child?.kill();
    child = undefined;
  });

  it('reports a fully SES-hardened realm inside a forked api worker', function(done) {
    let stdout = '';
    child = spawn(lavamoatBin, [
      '--policyPath', 'lavamoat/node/policy-api.json',
      entry,
      // Everything after `--` is passed through to the entry script's own
      // argv untouched. Without this separator, lavamoat's CLI arg parser
      // reconstructs process.argv from its own backward-compatibility path,
      // which leaves process.argv[1] pointing at a lavamoat CLI flag
      // instead of the entry path -- and cluster.fork()'s default re-exec
      // target is process.argv[1], so forked workers fail to spawn at all.
      // Confirmed empirically against a standalone cluster.fork() script
      // before relying on it here.
      '--',
      '--CLUSTER', 'true'
    ], {
      cwd: projectRoot,
      // This repo's own test:integration npm script runs with
      // BCN_LOG_LEVEL=none, which would silence the very log line this
      // test depends on if inherited. Force it back to 'info' rather than
      // trusting whatever the parent process happened to have set --
      // confirmed empirically that BCN_LOG_LEVEL propagates through spawn's
      // default env inheritance.
      env: { ...process.env, BCN_LOG_LEVEL: 'info' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout!.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      const match = stdout.match(/LAVAMOAT_WORKER_SES_SIGNAL (\{.*\})/);
      if (!match) {
        return;
      }
      try {
        const signal = JSON.parse(match[1]);
        expect(signal.hasHarden).to.equal(true);
        expect(signal.objectProtoFrozen).to.equal(true);
        expect(signal.canAddPropToObjectProto).to.equal(false);
        done();
      } catch (err) {
        done(err);
      }
    });
    child.on('error', done);
  });
});
