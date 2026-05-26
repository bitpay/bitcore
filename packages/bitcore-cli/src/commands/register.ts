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

  if (wallet.client.credentials.tssKeyId) {
    // Calling `wallet.register` will only register the wallet as a single-sig (non-TSS) wallet.
    // Importing a TSS wallet to a new server will need to initialize a tsskeygen Mongo document on the server
    // and include the tssKeyId in the wallet registration process.
    prompt.log.error('This wallet appears to to be a TSS wallet. Registering an existing TSS wallet on a different server is not yet supported.');
    return;
  }

  const copayerName = wallet.client.credentials.copayerName || process.env.USER || 'copayer';
  await wallet.register({ copayerName });
  prompt.log.success('Wallet registered');
};
