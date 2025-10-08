import * as prompt from '@clack/prompts';
import fs from 'fs';
import os from 'os';
import type { CommonArgs } from '../../types/cli';
import { getFileName } from '../prompts';
import { Utils } from '../utils';

export function command(args: CommonArgs) {
  const { wallet, program } = args;
  program
    .description('List unspent transaction outputs (UTXOs) for a wallet')
    .usage('<walletName> --command utxos [options]')
    .optionsGroup('UTXOs Options')
    .option('--expand', 'Display in expanded format')
    .option('--sortBy <field>', 'Sort by "amount" or "time"', 'time')
    .option('--sortDir <direction>', 'Sort direction "asc" or "desc"', 'asc')
    .option('--raw', 'Print raw UTXO objects instead of formatted output')
    .option('--export [filename]', `Export UTXOs to a file (default: ~/${wallet.name}_utxos_<timestamp>.json)`)
    .parse(process.argv);

  const opts = program.opts();
  if (opts.help) {
    program.help();
  }

  return opts;
}

export async function getUtxos(
  args: CommonArgs<{
    expand?: boolean;
    sortBy?: 'amount' | 'time';
    sortDir?: 'asc' | 'desc';
    export?: string;
    raw?: boolean;
  }>
) {
  const { wallet, opts } = args;
  if (opts.command) {
    Object.assign(opts, command(args));
  }
  const utxos = await wallet.client.getUtxos({});

  if (utxos.length === 0) {
    prompt.log.info('No UTXOs found for this wallet.');
    return;
  }

  enum ACTIONS {
    FORMAT = 'f',
    SORT = 's',
    REVERSE_SORT = '~',
    PRINT_RAW = 'r',
    EXPORT = 'e',
    EXIT = 'x'
  };

  let action: string | symbol = opts.export ? ACTIONS.EXPORT : undefined;
  let compact = !opts.expand; // default to compact view
  let printRaw = opts.raw ?? false;
  let sort = opts.sortBy || 'time'; // default sort by time
  let sortDir = opts.sortDir === 'desc' ? -1 : 1; // 1 for ascending, -1 for descending
  do {
    if (action === ACTIONS.FORMAT) {
      compact = !compact; // toggle compact view
      printRaw = false; // reset printRaw when toggling format
    }
    if (action === ACTIONS.PRINT_RAW) {
      printRaw = !printRaw; // toggle raw view
    }
    if (action === ACTIONS.SORT) {
      if (sort === 'amount') {
        // sort by time
        sort = 'time';
        utxos.sort((a, b) => {
          return sortDir == -1 ? (b.confirmations || 0) - (a.confirmations || 0) : (a.confirmations || 0) - (b.confirmations || 0);
        });
      } else {
        // sort by amount
        sort = 'amount';
        utxos.sort((a, b) => {
          return sortDir == -1 ? b.amount - a.amount : a.amount - b.amount;
        });
      }
    }
    if (action === ACTIONS.REVERSE_SORT) {
      sortDir *= -1; // reverse sort direction
      utxos.reverse(); // reverse the array
    }

    if (action === ACTIONS.EXPORT) {
      const defaultValue = `~/${wallet.name}_utxos_${new Date().toISOString()}.json`;
      const filename = opts.command
        ? Utils.replaceTilde(typeof opts.export === 'string' ? opts.export : defaultValue)
        : await getFileName({
            message: 'Enter output file name:',
            defaultValue: `~/${wallet.name}_utxos_${new Date().toISOString()}.json`
          });
      await fs.promises.writeFile(filename, JSON.stringify(utxos));
      prompt.log.info(`UTXOs exported to: ${filename}`);
    } else if (printRaw) {
      prompt.log.info(`Raw UTXOs:${os.EOL}` + JSON.stringify(utxos, null, 2));
    } else {
      const lines = [];
      for (const utxo of utxos) {
        const address = compact ? Utils.compactString(utxo.address) : utxo.address;
        const txid = compact ? Utils.compactString(utxo.txid) : utxo.txid;
        const amount = Utils.renderAmount(wallet.client.credentials.coin, utxo.satoshis);
        lines.push(`[${txid}:${utxo.vout}] ${amount} ${address} (${utxo.path}) (${utxo.confirmations || 0} confs)`);
      };
      prompt.note(lines.join(os.EOL), 'UTXOs');
    }

    action = opts.command ? ACTIONS.EXIT : await prompt.selectKey({
      message: 'Page Controls:',
      options: [
        compact ? { value: ACTIONS.FORMAT, label: 'Expand format' } : { value: ACTIONS.FORMAT, label: 'Compact format' },
        sort === 'amount' ? { value: ACTIONS.SORT, label: 'Sort by time' } : { value: ACTIONS.SORT, label: 'Sort by amount' },
        sortDir === -1 ? { value: ACTIONS.REVERSE_SORT, label: 'Sort ascending' } : { value: ACTIONS.REVERSE_SORT, label: 'Sort descending' },
        printRaw ? { value: ACTIONS.PRINT_RAW, label: 'Print pretty' } : { value: ACTIONS.PRINT_RAW, label: 'Print raw UTXOs' },
        { value: ACTIONS.EXPORT, label: 'Export to file' },
        { value: ACTIONS.EXIT, label: 'Close' }
      ]
    });
  } while (action !== ACTIONS.EXIT);
};