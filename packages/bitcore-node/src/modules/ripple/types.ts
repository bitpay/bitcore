import { ITransaction } from '../../models/baseTransaction';
export type IXrpTransaction = ITransaction & {
  from: string;
};
