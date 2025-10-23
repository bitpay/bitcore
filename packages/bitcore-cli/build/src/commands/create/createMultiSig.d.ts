import { type Network } from 'bitcore-wallet-client';
import type { CommonArgs } from '../../../types/cli';
export declare function createMultiSigWallet(args: CommonArgs<{
    mnemonic?: string;
}> & {
    chain: string;
    network: Network;
    m: number;
    n: number;
}): Promise<{
    mnemonic: string;
}>;
//# sourceMappingURL=createMultiSig.d.ts.map