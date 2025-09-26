import * as prompt from '@clack/prompts';
import type { CommonArgs } from '../../types/cli';

export function command(args: CommonArgs) {
  const { program } = args;
  program
    .description('Scan the wallet\'s addresses for transactions')
    .usage('<walletName> --command scan [options]')
    .optionsGroup('Scan Options')
    .option('--startIdx <idx>', 'Address index to start scanning from (support agents only)')
    .parse(process.argv);

  const opts = program.opts();
  if (opts.help) {
    program.help();
  }

  return opts;
}

export async function scanWallet(args: CommonArgs<{ startIdx?: number }> ) {
  const { wallet, opts } = args;
  if (opts.command) {
    Object.assign(opts, command(args));
  }
  await wallet.client.startScan({ startIdx: opts.startIdx });
  prompt.log.success('Scan started...');
};
