import * as prompt from '@clack/prompts';
import { Command } from 'commander';
import type { CommonArgs } from '../../types/cli';

export function command() {
  return new Command('scan')
    .description('Scan the wallet\'s addresses for transactions')
    .optionsGroup('Scan Options')
    .option('--startIdx <idx>', 'Address index to start scanning from (support agents only)');
}

export async function scanWallet(args: CommonArgs<{ startIdx?: number }> ) {
  const { wallet, opts } = args;

  await wallet.client.startScan({ startIdx: opts.startIdx });
  prompt.log.success('Scan started...');
};
