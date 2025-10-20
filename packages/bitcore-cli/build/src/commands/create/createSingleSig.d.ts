import type { CommonArgs } from '../../../types/cli';
import { type Network } from 'bitcore-wallet-client';
export declare function createSingleSigWallet(args: CommonArgs<{
    mnemonic?: string;
}> & {
    chain: string;
    network: Network;
}): Promise<{
    mnemonic: string;
}>;
//# sourceMappingURL=createSingleSig.d.ts.map