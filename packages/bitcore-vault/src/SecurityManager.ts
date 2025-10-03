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

    public setBaselineSecureHeapAllocation(): void {
        this.secureHeapBaseAllocation = this.getCurrentSecureHeapAllocation();
    }
}