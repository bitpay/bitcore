import { Network } from 'bitcore-wallet-client';
import { ICliOptions } from '../../../types/cli';
import { Wallet } from '../../wallet';
export declare function createMultiSigWallet(args: {
    wallet: Wallet;
    chain: string;
    network: Network;
    m: number;
    n: number;
    opts: ICliOptions & {
        mnemonic?: string;
    };
}): Promise<{
    mnemonic: string;
}>;
//# sourceMappingURL=createMultiSig.d.ts.map