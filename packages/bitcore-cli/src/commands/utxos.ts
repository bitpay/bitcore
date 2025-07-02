import * as prompt from '@clack/prompts';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Utils } from '../utils';
import { Wallet } from '../wallet';
import { ICliOptions } from '../../types/cli';

export async function getUtxos(args: {
  wallet: Wallet;
  opts: ICliOptions;
}) {
  const { wallet, opts } = args;
  const utxos = await wallet.client.getUtxos({});

  if (utxos.length === 0) {
    prompt.log.info('No UTXOs found for this wallet.');
    return;
  }

  let action: string | symbol;
  let compact = true;
  let printRaw = false;
  let sort = 'time'; // default sort by time
  let sortDir = 1; // 1 for ascending, -1 for descending
  do {
    if (action === 'f') {
      compact = !compact; // toggle compact view
      printRaw = false; // reset printRaw when toggling format
    }
    if (action === 'r') {
      printRaw = !printRaw; // toggle raw view
    }
    if (action === 's') {
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
    if (action === '~') {
      sortDir *= -1; // reverse sort direction
      utxos.reverse(); // reverse the array
    }

    if (action === 'e') {
      const filename = path.join(os.homedir(), `${wallet.name}-utxos-${new Date().toISOString()}.json`);
      await fs.promises.writeFile(filename, JSON.stringify(utxos));
      prompt.log.info(`UTXOs exported to: ${filename}`);
    } else if (printRaw) {
      prompt.log.info(`Raw UTXOs:${os.EOL}` + JSON.stringify(utxos, null, 2));
    } else {
      const lines = [];
      for (const utxo of utxos) {
        const address = compact ? Utils.compactString(utxo.address) : utxo.address;
        const txid = compact ? Utils.compactString(utxo.txid) : utxo.txid;
        const amount = Utils.renderAmount(utxo.satoshis, wallet.client.credentials.coin);
        lines.push(`[${txid}:${utxo.vout}] ${amount} ${address} (${utxo.path}) (${utxo.confirmations || 0} confs)`);
      };
      prompt.note(lines.join(os.EOL), 'UTXOs');
    }

    action = await prompt.selectKey({
      message: 'Page Controls:',
      options: [
        compact ? { value: 'f', label: 'Expand format' } : { value: 'f', label: 'Compact format' },
        sort === 'amount' ? { value: 's', label: 'Sort by time' } : { value: 's', label: 'Sort by amount' },
        sortDir === -1 ? { value: '~', label: 'Sort ascending' } : { value: '~', label: 'Sort descending' },
        printRaw ? { value: 'r', label: 'Print pretty' } : { value: 'r', label: 'Print raw UTXOs' },
        { value: 'e', label: 'Export to file' },
        { value: 'x', label: 'Close' }
      ]
    });
  } while (action !== 'x');
};