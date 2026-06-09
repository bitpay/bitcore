import { Utils as CWCUtils, xrpl } from '@bitpay-labs/crypto-wallet-core';
import * as prompt from '@clack/prompts';
import { promptXrpFlag } from '../prompts';
import { Utils } from '../utils';
import { type ITransactionArgs, createTransaction, command as txCommand } from './transaction';
import type { CommonArgs } from '../../types/cli';

function flagsDisplay() {
  const flags = Object.keys(xrpl.AccountSetTfFlags).filter(k => isNaN(parseInt(k))); // filter out numeric keys
  return 'Possible flags are: ' + flags.join(', ');
}

export function command(args: CommonArgs<ITransactionArgs>) {
  const { program } = args;
  program
    .description('View and manage XRP wallet flags')
    .usage('<walletName> --command flags [options]')
    .optionsGroup('Flags Options')
    .option('--flags <flags>', 'Comma-delimited list of account transaction flag(s) to set. If provided, see Transaction Options below for additional options to provide for the setting transaction. ' + flagsDisplay());
    
  const opts = txCommand({
    ...args,
    opts: {
      ...args.opts,
      extensionOpts: {
        excludedOptions: new Set(['--to', '--amount']),
        parse: (opts) => {
          if (opts.flags) {
            const flags = opts.flags.split(',').map(f => CWCUtils.normalizeXrpFlag(f.trim()));
            if (flags.some(f => !f)) {
              throw new Error('Invalid flag(s) specified. ' + flagsDisplay());
            }
            opts.flags = flags.join(',');
          }
        }
      }      
    }
  });

  return opts;
}

export async function getOrSetFlags(args: CommonArgs<ITransactionArgs>) {
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

  const flags = opts.command ? opts.flags : await promptXrpFlag(existingFlags);

  if (flags) {
    opts.flags = flags;
    opts.to = (await wallet.client.getMainAddresses())[0].address;
    opts.amount = '0';
    opts.txType = 'AccountSet';
    await createTransaction(args);
  }

  return { action: 'menu' };
};
