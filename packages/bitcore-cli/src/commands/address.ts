import * as prompt from '@clack/prompts';
import { Wallet } from '../wallet';
import { ICliOptions } from '../../types/cli';

export async function createAddress(args: {
  wallet: Wallet;
  opts: ICliOptions;
}) {
  const { wallet, opts } = args;
  const x = await wallet.client.createAddress({});
  prompt.note(x.address, `Address (${x.path})`);
};
