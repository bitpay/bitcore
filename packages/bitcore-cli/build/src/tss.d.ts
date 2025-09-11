import { type Types as CWCTypes } from 'crypto-wallet-core';
import { type WalletData } from '../types/wallet';
export declare function sign(args: {
    host: string;
    chain: string;
    walletData: WalletData;
    messageHash: Buffer;
    derivationPath: string;
    password?: string;
    id?: string;
    logMessageWaiting?: string;
    logMessageCompleted?: string;
}): Promise<CWCTypes.Message.ISignedMessage<string>>;
//# sourceMappingURL=tss.d.ts.map