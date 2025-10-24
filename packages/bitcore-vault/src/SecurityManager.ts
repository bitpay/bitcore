import net from 'node:net';
import inspector from 'node:inspector';
import { secureHeapUsed } from 'crypto';

export class SecurityManager {
  private secureHeapBaseAllocation: number;
    
  constructor() {
    
  }

  public async runAllSecurityChecks(): Promise<{ result: boolean; reason?: string }> {
    const quickChecks = this.runQuickSecurityCheck();
    if (!quickChecks.reason) {
      return quickChecks;
    }
    const slowChecks = await this.runSlowSecurityCheck();
    if (!slowChecks.result) {
      return slowChecks;
    }
    return { result: true };
  }

  public runQuickSecurityCheck(): { result: boolean; reason?: string } {
    try {
      if (!SecurityManager.isSecureHeapEnabled()) {
        return { result: false, reason: 'Secure heap is not enabled' };
      }
    
      const { verified: secureHeapAllocationVerified, actual, expected } = this.VerifyExpectedSecureHeapAllocation();
      if (!secureHeapAllocationVerified) {
        return { result: false, reason: `Secure heap allocation verification failed - expected: ${expected}, actual: ${actual}` };
      }

      if (SecurityManager.inspectorUrlExists()) {
        return { result: false, reason: 'Inspector url detected' };
      }
      return { result: true };
    } catch (err) {
      return { result: false, reason: err.message };
    }
  }

  public async runSlowSecurityCheck(): Promise<{ result: boolean; reason?: string }> {
    if (await SecurityManager.probeDebugPort()) {
      return { result: false, reason: 'Open debug port detected' };
    }
    return { result: true };
  }

  /**
     * Kills process if false
     */
  public static isSecureHeapEnabled(): boolean {
    const { total } = secureHeapUsed();
    return total > 0;
  }
    
  public secureHeapAllocationCheck(): boolean {
    return this.secureHeapBaseAllocation >= SecurityManager.getCurrentSecureHeapAllocation();
  } 

  // Helpers
  public static getCurrentSecureHeapAllocation(): number {
    const { used } = secureHeapUsed();
    return used;
  }

  public setBaselineSecureHeapAllocation(alloc: number): void {
    console.log(`Setting baseline secure heap allocation size - ${alloc} bytes`);
    this.secureHeapBaseAllocation = alloc;
  }

  /**
     * @TODO - behaviors on failure conditions
     */
  public VerifyExpectedSecureHeapAllocation(): { verified: boolean; actual: number; expected: number } {
    const currentAllocation = SecurityManager.getCurrentSecureHeapAllocation();
    if (typeof currentAllocation !== 'number' || currentAllocation <= 0) {
      throw new Error('Messed up stuff - TODO');
    }
    if (typeof this.secureHeapBaseAllocation !== 'number' || this.secureHeapBaseAllocation <= 0) {
      throw new Error('Messed up other stuff - other TODO');
    }

    /**
     * @IMPLEMENTATION NOTE: This is a naive measurement that may not always hold up - it needs a critical assessment
     */
    return {
      verified: currentAllocation >= this.secureHeapBaseAllocation,
      actual: currentAllocation,
      expected: this.secureHeapBaseAllocation
    };
  }

  // Returns true if probe finds live debug port
  public static async probeDebugPort(timeoutMs = 150): Promise<boolean> {
    try {
      const port = Number((process as any).debugPort || 0);
      if (!Number.isFinite(port) || port <= 0) return false;
      const net = await import('node:net');
      return await new Promise<boolean>((resolve) => {
        const sock = net.createConnection({ host: '127.0.0.1', port });
        const done = (v: boolean) => { try { sock.destroy(); } catch {} resolve(v); };
        const t = setTimeout(() => done(false), Math.min(Math.max(1, timeoutMs), 150));
        sock.once('connect', () => { clearTimeout(t); done(true); });
        sock.once('error', () => { clearTimeout(t); done(false); });
      });
    } catch {
      return true;
    }
  }

  public static inspectorUrlExists(): boolean {
    try {
      const url = inspector.url?.();
      if (typeof url === 'string' && url.length > 0) {
        console.error('[SecurityManager] CRITICAL: Inspector/debugger detected!');
        console.error('[SecurityManager] Inspector URL:', url);
        console.error('[SecurityManager] This likely means SIGUSR1 signal was received.');
        console.error('[SecurityManager] Explanation: Node.js inspector registers SIGUSR1 handler');
        console.error('[SecurityManager] at C++ level, which cannot be prevented by JavaScript.');
        console.error('[SecurityManager] The signal was detected by security check (working as designed).');
        console.error('[SecurityManager] Process will now terminate.');
        return true;
      }
      return false;
    } catch {
      console.error('[SecurityManager] Error checking inspector URL - treating as suspicious');
      return true;
    }
  }

  public static checkInspectFlagsAtLaunch(): boolean {
    try {
      const argv = (process.execArgv || []).join(' ');
      const nodeOpts = String(process.env.NODE_OPTIONS || '');
      const rx = /--inspect(?:-brk)?\b|--inspect-port\b/;
      return rx.test(argv) || rx.test(nodeOpts);
    } catch {
      console.error('checkInspectFlagsAtLaunch failed');
      return true;
    }
  }
}