import * as prompt from '@clack/prompts';
import { Wallet } from '../wallet';
import { ICliOptions } from '../../types/cli';

export async function scanWallet(args: {
  wallet: Wallet;
  opts: ICliOptions;
}) {
  const { wallet, opts } = args;
  await wallet.client.startScan({});
  prompt.log.success('Scan started...');
};
