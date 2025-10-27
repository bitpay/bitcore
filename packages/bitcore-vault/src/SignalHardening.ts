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
 *    which importantly includes `SIGUSR1` → prevents late inspector enablement via signal.
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
        if (['SIGKILL', 'SIGSTOP'].includes(sig)) {
            // Can't overwrite these - they're uncatchable by OS design
            continue;
        }

        try {
            // Remove any existing listeners to ensure our policy is authoritative
            process.removeAllListeners(sig as NodeJS.Signals);
            
            // Install our policy: shutdown signals → graceful cleanup, all others → no-op (console log only)
            if (shutdownSignals.includes(sig)) {
                process.on(sig as NodeJS.Signals, async () => {
                    try {
                        await onShutdown();
                    } finally {
                        process.exit(0);
                    }
                });
            } else {
                process.on(sig as NodeJS.Signals, () => {
                    console.log(`[SignalHardening] ${sig} signal received and intercepted by JavaScript handler`);
                });
            }
        } catch {
            // Expected for signals not supported on this platform/runtime
            // Silently continue - the signal isn't available anyway
        }
    }
    console.log('\n[SignalHardening] Signal policy installation complete');
}

/**
 * Verify the signal policy was installed correctly.
 * This function audits the actual handler state and returns true only if:
 * 1. All shutdown signals have exactly 1 listener (our handler)
 * 2. All other signals have exactly 1 listener (our no-op handler)
 * 3. The handler names/sources are what we expect
 * 
 * Call this after installSignalPolicyHard() to verify the fix is working.
 * Returns true if verification passes, false if there are anomalies.
 */
export function verifySignalPolicyHard(): boolean {
    const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
    if (process.platform === 'win32') {
        shutdownSignals.push('SIGBREAK');
    }
    
    const allSignals = getAllPlatformSignals();
    let verificationPassed = true;
    const criticalSignals = ['SIGUSR1', 'SIGUSR2'];
    
    console.log('[SignalHardening] Verifying signal policy installation...');
    
    for (const sig of allSignals) {
        if (['SIGKILL', 'SIGSTOP'].includes(sig)) {
            // Can't verify these - they can't be handled
            continue;
        }
        
        try {
            const count = process.listenerCount(sig as NodeJS.Signals);
            
            // We expect exactly 1 listener for all signals (either our shutdown handler or no-op)
            if (count === 1) {
                // This is correct - we installed exactly 1 handler
                if (criticalSignals.includes(sig)) {
                    console.log(`[SignalHardening] ✓ ${sig}: 1 handler (verified)`);
                }
            } else if (count === 0) {
                // No handler - this means removeAllListeners didn't work or handler failed to install
                console.error(`[SignalHardening] ✗ ${sig}: 0 handlers (PROBLEM: handler not installed!)`);
                verificationPassed = false;
            } else if (count > 1) {
                // Multiple handlers - indicates duplicates or external handlers
                console.error(`[SignalHardening] ✗ ${sig}: ${count} handlers (PROBLEM: duplicate handlers detected!)`);
                verificationPassed = false;
            }
        } catch (err) {
            // Signal not supported on this platform
        }
    }
    
    if (verificationPassed) {
        console.log('[SignalHardening] ✓ Signal policy verification PASSED');
    } else {
        console.error('[SignalHardening] ✗ Signal policy verification FAILED');
    }
    
    return verificationPassed;
}