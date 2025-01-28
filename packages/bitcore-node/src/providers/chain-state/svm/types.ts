import { ITransaction } from '../../../models/baseTransaction';

export type ISVMTransaction = ITransaction & {
  category?: string;
  from: string;
  to?: string;
  status?: string;
  txType?: string;
  error?: any;
  tokenTransfers: any[];
  accountData: any[];
  instructions: any[];
}