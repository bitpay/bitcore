import * as prompt from '@clack/prompts';
import { Wallet } from '../wallet';

export async function createAddress(args: {
  wallet: Wallet;
  opts: {
    verbose: boolean;
  }
}) {
  const { wallet, opts } = args;
  const x = await wallet.client.createAddress({});
  prompt.note(x.address, `Address (${x.path})`);
};
