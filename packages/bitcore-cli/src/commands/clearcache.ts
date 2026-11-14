import * as prompt from '@clack/prompts';
import { Command } from 'commander';
import type { CommonArgs } from '../../types/cli';

export function command() {
  return new Command('clearcache')
    .description('Clear the wallet\'s transaction cache at BWS')
    .optionsGroup('Clear Cache Options');
}

export async function clearCache(args: CommonArgs) {
  const { wallet, opts } = args;

  await wallet.client.clearCache({ tokenAddress: opts.tokenAddress });
  prompt.log.success('Cache cleared.');
};
