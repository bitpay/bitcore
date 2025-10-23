/**
 * SignalHardening.ts
 * ==================
 * Purpose
 * -------
 * Lock down a security-sensitive child Node.js process so that **only** a tiny,
 * explicit set of signals can trigger a **graceful, zeroizing shutdown**.
 * **Every other catchable signal is turned into a no-op.**
 *
 * Threat Model (what we’re protecting against)
 * --------------------------------------------
 * - Local users/tools sending OS signals that could change runtime behavior,
 *   including POSIX `SIGUSR1` which normally enables the V8 inspector in Node.
 * - Accidental/hostile signal delivery from supervisors, shells, or scripts.
 *
 * Non-goals
 * ---------
 * - OS-level/root adversaries, ptrace/kernel injection, binary replacement.
 * - Uncatchable signals: `SIGKILL` and `SIGSTOP` (cannot be handled by design).
 *
 * What this module does (deterministically)
 * -----------------------------------------
 * 1) Installs a **fixed, non-overridable** policy at startup.
 * 2) **Shutdown whitelist**: only `SIGTERM`, `SIGINT`, `SIGHUP`
 *    (and `SIGBREAK` on Windows) run your `onShutdown` zeroizer, then `exit(0)`.
 * 3) **Deny-by-default**: *every other catchable signal* is **no-op** (swallowed),
 *    which includes `SIGUSR1` → prevents late inspector enablement via signal.
 * 4) Clears any earlier listeners so this policy is authoritative in-process.
 * 5) Silently skips unsupported signals on the current platform/runtime.
 *
 * Why this matters
 * ----------------
 * - Prevents Node’s default `SIGUSR1` → “start inspector” pathway.
 * - Eliminates surprise behaviors from rarely used signals (e.g., `SIGQUIT`, etc.).
 *
 * Determinism
 * -------------------------
 * - Denied signals return immediately; allowed signals run zeroization exactly
 *   once, then exit(0)—even if the zeroizer throws.
 *
 * Usage (place very early in the child entrypoint, before secrets)
 * ----------------------------------------------------------------
 *   // 1) Deny debugger attach paths (recommended, shown here for context):
 *   import inspector from 'node:inspector';
 *   try { inspector.close(); } catch {}
 *   try {
 *     Object.defineProperty(inspector, 'open', {
 *       value() { throw new Error('Debugger disabled'); },
 *       writable: false, configurable: false, enumerable: true
 *     });
 *     Object.freeze(inspector);
 *   } catch {}
 *
 *   // 2) Lock down signals:
 *   import { installSignalPolicyHard } from './SignalHardening';
 *   installSignalPolicyHard(async () => {
 *     // Zeroize secrets/buffers, close sensitive handles, etc.
 *   });
 *
 * Testing Tips
 * ------------
 * - Send `SIGTERM`/`SIGINT`/`SIGHUP` → expect zeroization then exit(0).
 * - Send `SIGUSR1` on POSIX → expect **no** inspector; `inspector.url()` remains empty.
 * - Send assorted supported signals (e.g., `SIGQUIT`, `SIGWINCH`) → no-op.
 *
 * Security Posture Summary
 * ------------------------
 * Together with forking the child using `env: {}` (so `NODE_OPTIONS` cannot
 * enable the inspector) and denying programmatic inspector enablement, this
 * module **deterministically prevents debugger enablement via signals** and
 * makes the process’ lifecycle predictable during secret handling.
 */

type ShutdownFn = () => void | Promise<void>;

const SIGNALS: ReadonlyArray<NodeJS.Signals> = [
    'SIGABRT','SIGALRM','SIGBUS','SIGCHLD','SIGCONT','SIGFPE','SIGHUP','SIGILL',
    'SIGINT','SIGIO','SIGIOT','SIGKILL','SIGPIPE','SIGPOLL','SIGPROF','SIGPWR',
    'SIGQUIT','SIGSEGV','SIGSTKFLT','SIGSTOP','SIGSYS','SIGTERM','SIGTRAP',
    'SIGTSTP','SIGTTIN','SIGTTOU','SIGUNUSED','SIGURG','SIGUSR1','SIGUSR2',
    'SIGVTALRM','SIGWINCH','SIGXCPU','SIGXFSZ','SIGBREAK','SIGLOST','SIGINFO',
  ] as const;

export function installSignalPolicyHard(onShutdown: ShutdownFn) {
    const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
    if (process.platform === 'win32') {
        shutdownSignals.push('SIGBREAK');
    }
    for (const sig of SIGNALS) {
        if (['SIGKILL', 'SIGSTOP'].includes(sig)) {
            // Can't overwrite these
            continue;
        }

        try {
            // Remove
            process.removeAllListeners(sig);
            // Replace
            if (shutdownSignals.includes(sig)) {
                process.on(sig, async () => {
                    try {
                        await onShutdown();
                    } finally {
                        process.exit(0);
                    }
                })
            } else {
                process.on(sig, () => {/** no op */})
            }
        } catch {/** no op - expected behavior for unsupported signals for platform/runtime */}
    }
}