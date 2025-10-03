import { secureHeapUsed } from 'crypto';

export class SecurityManager {
    private secureHeapBaseAllocation: number;
    
    constructor() {}

    public runSecurityCheck() {
        // const isSecureHeap
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
    public VerifyExpectedSecureHeapAllocation(): boolean {
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
        const isVerified = currentAllocation >= this.secureHeapBaseAllocation;
        if (!isVerified) {
            throw new Error('Messed up third stuff - third TODO');
        }
        return isVerified;
    }
}