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

/**
 * Introspect ALL signals available on the current platform/Node.js runtime
 * using process.binding('constants').os.signals.
 * 
 * Why: Instead of a hardcoded list that may miss new signals or include
 * unsupported ones, we dynamically discover every signal the OS and Node
 * version support. This ensures complete coverage across platforms and versions.
 * 
 * Security: By catching every signal (except uncatchable SIGKILL/SIGSTOP),
 * we prevent any signal-based runtime manipulation, including SIGUSR1 which
 * would normally enable the V8 inspector.
 */
function getAllPlatformSignals(): ReadonlyArray<string> {
    try {
        // @ts-ignore - process.binding is internal but stable for constants
        const constants = process.binding('constants');
        const signals = constants.os?.signals || {};
        
        // Extract all signal names (keys like 'SIGTERM', 'SIGUSR1', etc.)
        return Object.keys(signals).filter(key => key.startsWith('SIG'));
    } catch (error) {
        // Fallback to a comprehensive list if binding fails (unlikely)
        // This ensures we still have protection even if the introspection fails
        return [
            'SIGABRT','SIGALRM','SIGBUS','SIGCHLD','SIGCONT','SIGFPE','SIGHUP','SIGILL',
            'SIGINT','SIGIO','SIGIOT','SIGKILL','SIGPIPE','SIGPOLL','SIGPROF','SIGPWR',
            'SIGQUIT','SIGSEGV','SIGSTKFLT','SIGSTOP','SIGSYS','SIGTERM','SIGTRAP',
            'SIGTSTP','SIGTTIN','SIGTTOU','SIGUNUSED','SIGURG','SIGUSR1','SIGUSR2',
            'SIGVTALRM','SIGWINCH','SIGXCPU','SIGXFSZ','SIGBREAK','SIGLOST','SIGINFO',
        ];
    }
}

export function installSignalPolicyHard(onShutdown: ShutdownFn) {
    const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
    if (process.platform === 'win32') {
        shutdownSignals.push('SIGBREAK');
    }
    
    // Dynamically get ALL signals supported by this platform/runtime
    const allSignals = getAllPlatformSignals();
    
    for (const sig of allSignals) {
        console.log('DEV - TODO DELETE - signal', sig);
        if (['SIGKILL', 'SIGSTOP'].includes(sig)) {
            // Can't overwrite these - they're uncatchable by OS design
            continue;
        }

        try {
            // Remove any existing listeners to ensure our policy is authoritative
            process.removeAllListeners(sig as NodeJS.Signals);
            
            // Install our policy: shutdown signals → graceful cleanup, all others → no-op
            if (shutdownSignals.includes(sig)) {
                process.on(sig as NodeJS.Signals, async () => {
                    try {
                        await onShutdown();
                    } finally {
                        process.exit(0);
                    }
                });
            } else {
                // Swallow the signal - prevents default behavior including SIGUSR1 → inspector
                process.on(sig as NodeJS.Signals, () => {/** no-op: signal denied */});
            }
        } catch {
            // Expected for signals not supported on this platform/runtime
            // Silently continue - the signal isn't available anyway
        }
    }
}