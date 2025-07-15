import { Status } from 'bitcore-wallet-client';
import { ICliOptions } from '../../types/cli';
import { Wallet } from '../wallet';
export declare function getTxProposals(args: {
    wallet: Wallet;
    status: Status;
    opts: ICliOptions & {
        pageSize: number;
    };
}): Promise<{
    action: string;
}>;
//# sourceMappingURL=txproposals.d.ts.map