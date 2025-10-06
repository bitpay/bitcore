import { secureHeapUsed } from 'crypto';

export class SecurityManager {
    private secureHeapBaseAllocation: number;
    
    constructor() {}

    public runSecurityCheck(): { result: boolean; reason?: string } {
        try {
            if (!this.isSecureHeapEnabled()) {
                return { result: false, reason: 'Secure heap is not enabled' };
            }
    
            const { verified: secureHeapAllocationVerified, actual, expected } = this.VerifyExpectedSecureHeapAllocation();
            if (!secureHeapAllocationVerified) {
                return { result: false, reason: `Secure heap allocation verification failed - expected: ${expected}, actual: ${actual}` }
            }
            return { result: true };
        } catch (err) {
            return { result: false, reason: err.message };
        }
    }

    /**
     * Kills process if false
     */
    public isSecureHeapEnabled(): boolean {
        const { total } = secureHeapUsed();
        return total > 0;
    }
    
    public secureHeapAllocationCheck(): boolean {
        return this.secureHeapBaseAllocation >= this.getCurrentSecureHeapAllocation();
    } 

    /**
     * Kills process if true
     */
    public isDebuggerDetected(): boolean {
        return false;
    }

    // Helpers
    public getCurrentSecureHeapAllocation(): number {
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
        const currentAllocation = this.getCurrentSecureHeapAllocation();
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
        }
    }
}