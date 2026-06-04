import { xrpl } from '@bitpay-labs/crypto-wallet-core';
import * as prompt from '@clack/prompts';
import { promptXrpFlag } from '../prompts';
import { Utils } from '../utils';
import type { CommonArgs } from '../../types/cli';

function flagsDisplay() {
  const flags = Object.keys(xrpl.AccountSetTfFlags);
  const half = flags.splice(flags.length / 2);
  return 'Possible flags are: \n\t' + flags.map((f, i) => `${f} | ${half[i]}`).join('\n\t');
}

export function command(args: CommonArgs) {
  const { program } = args;
  program
    .description('View and manage XRP wallet flags')
    .usage('<walletName> --command flags [options]')
    .optionsGroup('Flags Options')
    .option('--set <flag>', 'Toggle a chain-level flag on the wallet. ' + flagsDisplay())
    .option('--fee <fee>', 'Set the fee (in drops) for the transaction')
    .parse(process.argv);

  const opts = program.opts();
  if (opts.help) {
    program.help();
  }

  opts.set = isNaN(parseInt(opts.set)) ? xrpl.AccountSetTfFlags[opts.set] : parseInt(opts.set);

  return opts;
}

export async function getOrSetFlags(args: CommonArgs<{ set?: number }>) {
  const { wallet, opts } = args;
  if (opts.command) {
    Object.assign(opts, command(args));
  }
  
  if (!wallet.isXrp()) {
    prompt.log.error('Flags management is only available for XRP wallets');
  }

  const existingFlags = await wallet.getAccountFlags();
  prompt.note(
    Object.entries(existingFlags)
      .map(([key, value]) => `${key}: ${value ? Utils.colorText('ON', 'green') : Utils.colorText('OFF', 'red')}`)
      .join('\n'),
    'Current XRP Account Flags'
  );

  const flag = opts.command ? opts.set : await promptXrpFlag();
  if (flag) {
    // TODO: create tx to set the flag
  }

  return { action: 'menu' };
};
