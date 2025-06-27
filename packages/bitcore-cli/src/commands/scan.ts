import * as prompt from '@clack/prompts';
import { Wallet } from '../wallet';

export async function scanWallet(args: {
  wallet: Wallet;
  opts: {
    verbose: boolean;
  }
}) {
  const { wallet, opts } = args;
  await wallet.client.startScan({});
  prompt.log.success('Scan started...');
};
