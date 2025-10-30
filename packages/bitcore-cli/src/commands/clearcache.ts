import * as prompt from '@clack/prompts';
import type { CommonArgs } from '../../types/cli';

export function command(args: CommonArgs) {
  const { program } = args;
  program
    .description('Clear the wallet\'s transaction cache at BWS')
    .usage('<walletName> --command clearcache [options]')
    .optionsGroup('Clear Cache Options')
    .parse(process.argv);

  const opts = program.opts();
  if (opts.help) {
    program.help();
  }

  return opts;
}

export async function clearCache(args: CommonArgs) {
  const { wallet, opts } = args;
  if (opts.command) {
    Object.assign(opts, command(args));
  }
  await wallet.client.clearCache({ tokenAddress: opts.tokenAddress });
  prompt.log.success('Cache cleared.');
};
