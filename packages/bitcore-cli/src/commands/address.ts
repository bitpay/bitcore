import * as prompt from '@clack/prompts';
import type { CommonArgs } from '../../types/cli';

export function command(args: CommonArgs) {
  const { program } = args;
  program
    .description('Create a new address')
    .usage('<walletName> --command address [options]')
    .optionsGroup('Address Options')
    .parse(process.argv);

  const opts = program.opts();
  if (opts.help) {
    program.help();
  }
  return opts;
}

export async function createAddress(args: CommonArgs) {
  const { wallet, program, opts } = args;
  if (program) {
    Object.assign(opts, command(args));
  }
  const x = await wallet.client.createAddress({});
  prompt.note(x.address, `Address (${x.path})`);
};
