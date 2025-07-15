import { Status } from 'bitcore-wallet-client';
import { ICliOptions } from '../../types/cli';
import { Wallet } from '../wallet';
export declare function createTransaction(args: {
    wallet: Wallet;
    status: Status;
    opts: ICliOptions & {
        pageSize: number;
    };
}): Promise<void>;
//# sourceMappingURL=transaction.d.ts.map