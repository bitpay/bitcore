import { ICliOptions } from '../../types/cli';
import { Wallet } from '../wallet';
export declare function getTxHistory(args: {
    wallet: Wallet;
    opts: ICliOptions & {
        pageSize: number;
    };
}): Promise<void>;
//# sourceMappingURL=txhistory.d.ts.map