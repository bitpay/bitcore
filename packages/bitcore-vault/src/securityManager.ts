import { secureHeapUsed } from 'crypto';
import inspector from 'node:inspector';

export class SecurityManager {
  private secureHeapBaseAllocation: number;
    
  constructor() {}

  public async runAllSecurityChecks(): Promise<{ result: boolean; reason?: string }> {
    const quickChecks = this.runQuickSecurityCheck();
    if (quickChecks.reason) {
      return quickChecks;
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

  public static isSecureHeapEnabled(): boolean {
    const { total } = secureHeapUsed();
    return total > 0;
  }

  // Helpers
  public static getCurrentSecureHeapAllocation(): number {
    const { used } = secureHeapUsed();
    return used;
  }

  public setBaselineSecureHeapAllocation(alloc: number): void {
    console.log(`[SecurityManager] Setting baseline secure heap allocation size - ${alloc} bytes`);
    this.secureHeapBaseAllocation = alloc;
  }

  public VerifyExpectedSecureHeapAllocation(): { verified: boolean; actual: number; expected: number } {
    const currentAllocation = SecurityManager.getCurrentSecureHeapAllocation();
    if (typeof currentAllocation !== 'number' || currentAllocation <= 0) {
      throw new Error('Expected current allocation to be a number greater than 0');
    }
    if (typeof this.secureHeapBaseAllocation !== 'number' || this.secureHeapBaseAllocation <= 0) {
      throw new Error('Expected secure heap base allocation to be a number greater than 0');
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

  public static inspectorUrlExists(): boolean {
    try {
      const url = inspector.url?.();
      if (typeof url === 'string' && url.length > 0) {
        console.error('[SecurityManager] CRITICAL: Inspector/debugger detected!');
        console.error('[SecurityManager] Inspector URL:', url);
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
      const isDetected = rx.test(argv) || rx.test(nodeOpts);
      if (isDetected) {
        console.warn('[SecurityManager] Inspect flags detected on secure process');
      }
      return isDetected; 
    } catch {
      console.error('[SecurityManager] checkInspectFlagsAtLaunch failed');
      return true;
    }
  }
}