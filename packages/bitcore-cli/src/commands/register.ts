import * as prompt from '@clack/prompts';
import type { CommonArgs } from '../../types/cli';

export function command(args: CommonArgs) {
  const { program } = args;
  program
    .description('Register the wallet with the Bitcore Wallet Service')
    .usage('<walletName> --command register [options]')
    .optionsGroup('Register Options')
    .parse(process.argv);

  const opts = program.opts();
  if (opts.help) {
    program.help();
  }

  return opts;
}

export async function registerWallet(args: CommonArgs) {
  const { wallet, opts } = args;
  if (opts.command) {
    Object.assign(opts, command(args));
  }

  const copayerName = wallet.client.credentials.copayerName || process.env.USER || 'copayer';
  await wallet.register({ copayerName });
  prompt.log.success('Wallet registered');
};
