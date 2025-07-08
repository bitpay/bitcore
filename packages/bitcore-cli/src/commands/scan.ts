import * as prompt from '@clack/prompts';
import { ICliOptions } from '../../types/cli';
import { Wallet } from '../wallet';

export async function scanWallet(args: {
  wallet: Wallet;
  opts: ICliOptions;
}) {
  const { wallet, opts } = args;
  await wallet.client.startScan({});
  prompt.log.success('Scan started...');
};
