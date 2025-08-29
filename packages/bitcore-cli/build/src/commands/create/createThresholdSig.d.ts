import { type Network } from 'bitcore-wallet-client';
import type { CommonArgs } from '../../../types/cli';
export declare function createThresholdSigWallet(args: CommonArgs<{
    mnemonic?: string;
}> & {
    chain: string;
    network: Network;
    m: number;
    n: number;
}): Promise<{
    mnemonic: any;
}>;
//# sourceMappingURL=createThresholdSig.d.ts.map