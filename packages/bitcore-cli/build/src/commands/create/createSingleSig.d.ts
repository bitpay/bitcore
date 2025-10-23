import { type Network } from 'bitcore-wallet-client';
import type { CommonArgs } from '../../../types/cli';
export declare function createSingleSigWallet(args: CommonArgs<{
    mnemonic?: string;
}> & {
    chain: string;
    network: Network;
}): Promise<{
    mnemonic: string;
}>;
//# sourceMappingURL=createSingleSig.d.ts.map