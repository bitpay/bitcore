import fs from 'fs';
import os from 'os';
import * as prompt from '@clack/prompts';
import { Command } from 'commander';
import { getFileName } from '../prompts';
import { Utils } from '../utils';
import type { CommonArgs } from '../../types/cli';

export function command() {
  return new Command('utxos')
    .description('List unspent transaction outputs (UTXOs) for a wallet')
    .optionsGroup('UTXOs Options')
    .option('--page <number>', 'Specify the page number', (value) => {
      const pg = Number(value);
      if (!Number.isInteger(pg) || pg < 1) throw new Error('Page must be a positive integer');
      return pg;
    }, 1)
    .option('--expand', 'Display in expanded format')
    .option('--sortBy <field>', 'Sort by "amount" or "time"', 'time')
    .option('--sortDir <direction>', 'Sort direction "asc" or "desc"', 'asc')
    .option('--raw', 'Print raw UTXO objects instead of formatted output')
    .option('--export [filename]', 'Export UTXOs to a file (default: ~/<walletName>_utxos_<timestamp>.json)')
    .option('--overwrite', 'Overwrite the export file if it already exists', false)
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.export === true) { // --export given without a filename
        opts.export = `~/${thisCommand.parent?.name()}_utxos_${new Date().toISOString()}.json`;
      }
    });
}

export async function getUtxos(
  args: CommonArgs<{
    page?: number;
    expand?: boolean;
    sortBy?: 'amount' | 'time';
    sortDir?: 'asc' | 'desc';
    export?: string;
    raw?: boolean;
    overwrite?: boolean;
  }>
) {
  const { wallet, opts } = args;
  const { pageSize } = opts;
  const allUtxos = await wallet.client.getUtxos({});

  if (allUtxos.length === 0) {
    prompt.log.info('No UTXOs found for this wallet.');
    return {};
  }

  enum ACTIONS {
    FORMAT = 'f',
    SORT = 's',
    REVERSE_SORT = '~',
    PRINT_RAW = 'r',
    EXPORT = 'e',
    EXIT = 'x'
  };

  let compact = !opts.expand; // default to compact view
  let printRaw = opts.raw ?? false;
  let sort = opts.sortBy || 'time'; // default sort by time
  let sortDir = opts.sortDir === 'desc' ? -1 : 1; // 1 for ascending, -1 for descending
  const totalPages = Math.ceil(allUtxos.length / pageSize);
  let initialAction = opts.export ? ACTIONS.EXPORT : undefined;

  await Utils.paginate(async (page, action) => {
    action ??= initialAction;
    initialAction = undefined;
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
        allUtxos.sort((a, b) => {
          return sortDir == -1 ? (b.confirmations || 0) - (a.confirmations || 0) : (a.confirmations || 0) - (b.confirmations || 0);
        });
      } else {
        // sort by amount
        sort = 'amount';
        allUtxos.sort((a, b) => {
          return sortDir == -1 ? b.amount - a.amount : a.amount - b.amount;
        });
      }
    }
    if (action === ACTIONS.REVERSE_SORT) {
      sortDir *= -1; // reverse sort direction
      allUtxos.reverse(); // reverse the array
    }

    const utxos = allUtxos.slice((page - 1) * pageSize, page * pageSize);

    if (action === ACTIONS.EXPORT) {
      const defaultValue = `~/${wallet.name}_utxos_${new Date().toISOString()}.json`;
      const filename = opts.command
        ? Utils.replaceTilde(typeof opts.export === 'string' ? opts.export : defaultValue)
        : await getFileName({
          message: 'Enter output file name:',
          defaultValue
        });
      let doWrite = true;
      if (fs.existsSync(filename) && !opts.overwrite) {
        if (opts.command) {
          throw new Error(`File already exists: ${filename}. Use --overwrite to overwrite.`);
        }
        const overwritePrompt = await prompt.confirm({
          message: `File already exists: ${filename}. Overwrite?`,
          initialValue: false
        });
        doWrite = !prompt.isCancel(overwritePrompt) && overwritePrompt;
      }
      if (doWrite) {
        await fs.promises.writeFile(filename, JSON.stringify(allUtxos));
        prompt.log.info(`UTXOs exported to: ${filename}`);
      }
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
      prompt.note(lines.join(os.EOL), `UTXOs - Total: ${allUtxos.length}  (pg ${page}/${totalPages})`);
    }

    if (opts.command) {
      return {};
    }

    const extraChoices = [
      compact ? { value: ACTIONS.FORMAT, label: 'Expand format' } : { value: ACTIONS.FORMAT, label: 'Compact format' },
      sort === 'amount' ? { value: ACTIONS.SORT, label: 'Sort by time' } : { value: ACTIONS.SORT, label: 'Sort by amount' },
      sortDir === -1 ? { value: ACTIONS.REVERSE_SORT, label: 'Sort ascending' } : { value: ACTIONS.REVERSE_SORT, label: 'Sort descending' },
      printRaw ? { value: ACTIONS.PRINT_RAW, label: 'Print pretty' } : { value: ACTIONS.PRINT_RAW, label: 'Print raw UTXOs' },
      { value: ACTIONS.EXPORT, label: 'Export to file' },
    ];
    return { result: utxos, extraChoices, hasNextPage: allUtxos.length > page * pageSize };
  }, {
    pageSize,
    exitOn1Page: !!opts.command,
    initialPage: opts.page || 1
  });
  
  return { action: 'menu' };
};