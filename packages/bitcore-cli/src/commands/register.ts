import * as prompt from '@clack/prompts';
import { Command } from 'commander';
import type { CommonArgs } from '../../types/cli';

export function command() {
  return new Command('register')
    .description('Register the wallet with the Bitcore Wallet Service')
    .optionsGroup('Register Options');
}

export async function registerWallet(args: CommonArgs) {
  const { wallet } = args;

  const copayerName = wallet.client.credentials.copayerName || process.env.USER || 'copayer';
  await wallet.register({ copayerName });
  prompt.log.success('Wallet registered');
};
