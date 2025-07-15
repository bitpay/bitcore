import { Status } from 'bitcore-wallet-client';
import { ICliOptions } from '../../types/cli';
import { Wallet } from '../wallet';
export declare function walletStatus(args: {
    wallet: Wallet;
    opts: ICliOptions & {
        tokenName?: string;
    };
}): Promise<Status>;
//# sourceMappingURL=status.d.ts.map