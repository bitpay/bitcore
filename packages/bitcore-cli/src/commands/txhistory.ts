import * as prompt from '@clack/prompts';
import fs from 'fs';
import moment from 'moment';
import os from 'os';
import path from 'path';
import { ICliOptions } from '../../types/cli';
import { Utils } from '../utils';
import { Wallet } from '../wallet';

export async function getTxHistory(args: {
  wallet: Wallet;
  opts: ICliOptions & {
    pageSize: number;
  }
}) {
  const { wallet, opts } = args;
  const { pageSize } = opts;
  
  const token = {} as any; // TODO
  let compact = true; // default to compact view
  let printRaw = false;

  await Utils.paginate(async (page, viewAction) => {
    if (viewAction === 'f') {
      compact = !compact; // toggle compact view
      printRaw = false; // reset printRaw when toggling format
    }

    printRaw = viewAction === 'r' ? !printRaw : printRaw;
    const exportToFile = viewAction === 'e';

    const history = await wallet.client.getTxHistory({
      includeExtendedInfo: true,
      tokenAddress: token.contractAddress,
      limit: pageSize,
      skip: (page - 1) * pageSize
    });

    const extraChoices = [
      compact ? { value: 'f', label: 'Expand format' } : { value: 'f', label: 'Compact format' },
      printRaw ? { value: 'r', label: 'Print pretty' } : { value: 'r', label: 'Print raw tx objects' },
      { value: 'e', label: 'Export to file' }
    ];

    if (exportToFile) {
      await fs.promises.writeFile(path.join(os.homedir(), `${wallet.name}-tx-history[${page}].json`), JSON.stringify(history, null, 2));
      prompt.log.info(`Page ${page} exported to: ~/${wallet.name}-tx-history[${page}].json`);
      return { result: history, extraChoices };
    }

    if (printRaw) {
      prompt.log.info(`Raw Tx History:${os.EOL}` + JSON.stringify(history, null, 2));
      return { result: history, extraChoices };
    }

    const lines = [];
    let sum = 0;
    for (const tx of history) {
      const timestamp = moment(tx.time * 1000);
      let time = timestamp.toString();
      if (compact) {
        time = timestamp.format('YYYY-MM-DD HH:mm:ss');
      }
      const txid = compact ? Utils.compactString(tx.txid) : tx.txid;
      const amount = Utils.renderAmount(tx.amount, wallet.client.credentials.coin, token);
      const confirmations = tx.confirmations || 0;
      let direction = '';

      switch (tx.action) {
        case 'received':
          direction = '<=';
          sum = sum + tx.amount;
          break;
        case 'moved':
          sum = sum - tx.fees;
          direction = '==';
          break;
        case 'sent':
          direction = '=>';
          sum = sum - tx.amount - tx.fees;
          break;
      }

      const action = compact ? '' : ` ${tx.action}`;

      if (tx.size) { // utxo
        lines.push(`[${time}] ${txid} ${direction}${action} ${amount} (${(tx.fees / tx.size).toFixed(2)} sats/b) (${confirmations} confs)`);
      } else {
        lines.push(`[${time}] ${txid} ${direction}${action} ${amount} (${tx.fees} fee) (${confirmations} confs)`);
      }

      // if (opts.verbose) {
      //   lines.push(JSON.stringify(tx)); // TODO - make this more readable
      // }
    }

    prompt.note(lines.join(os.EOL), `Tx History (page ${page})`);

    return { result: history, extraChoices };
  }, {
    pageSize,
  });
};
