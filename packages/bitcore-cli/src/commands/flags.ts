import * as prompt from '@clack/prompts';
import { promptXrpFlag } from '../prompts';
import { Utils } from '../utils';
import { type ITransactionArgs, createTransaction, command as txCommand } from './transaction';
import type { CommonArgs } from '../../types/cli';


export function command(args: CommonArgs<ITransactionArgs>) {
  const { program } = args;
  program
    .description('View and manage XRP wallet flags')
    .usage('<walletName> --command flags [options]');
    
  const opts = txCommand({ ...args, opts: { ...args.opts, isExtension: true } });

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

  const flags = opts.command ? opts.flags : await promptXrpFlag();

  if (flags) {
    opts.flags = flags;
    opts.to = (await wallet.client.getMainAddresses())[0].address;
    opts.amount = '0';
    opts.txType = 'AccountSet';
    await createTransaction(args);
  }

  return { action: 'menu' };
};
