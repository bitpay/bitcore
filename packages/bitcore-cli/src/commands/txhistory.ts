import fs from 'fs';
import os from 'os';
import * as prompt from '@clack/prompts';
import { getFileName } from '../prompts';
import { Utils } from '../utils';
import type { CommonArgs } from '../../types/cli';
import type { ITokenObj } from '../../types/wallet';

export function command(args: CommonArgs) {
  const { wallet, program } = args;
  program
    .description('Get transaction history for a wallet')
    .usage('<walletName> --command history [options]')
    .optionsGroup('Transaction History Options')
    .option('--page <page>', 'Page number to display', '1')
    .option('--token <token>', 'Token to get the balance for (e.g. USDC)')
    .option('--tokenAddress <address>', 'Token contract address to get the balance for')
    .option('--expand', 'Display in expanded format')
    .option('--raw', 'Print raw transaction objects instead of formatted output')
    .option('--export [filename]', `Export the transaction history to a file (default: ~/${wallet.name}_txhistory_<date>_<page>.json)`)
    .parse(process.argv);

  const opts = program.opts();
  if (opts.help) {
    program.help();
  }
  
  return opts;
}

export async function getTxHistory(
  args: CommonArgs<{
    pageSize: number;
    page?: number;
    expand?: boolean;
    raw?: boolean;
    export?: string | boolean;
  }>) {
  const { wallet, opts } = args;

  if (opts.command) {
    Object.assign(opts, command(args));
  }
  

  let tokenObj: ITokenObj;
  if (opts.token || opts.tokenAddress) {
    tokenObj = await wallet.getToken(opts);
    if (!tokenObj) {
      throw new Error(`Unknown token "${opts.tokenAddress || opts.token}" on ${wallet.chain}:${wallet.network}`);
    }
  }
  const currency = tokenObj?.displayCode || wallet.client.credentials.coin;

  enum ViewAction {
    TOGGLE_FORMAT = 'f',
    TOGGLE_RAW = 'r',
    EXPORT = 'e'
  }

  let history = [];
  let compact = !opts.expand; // default to compact view
  let printRaw = !!opts.raw; // default false

  await Utils.paginate(async (page, viewAction) => {
    if (viewAction === ViewAction.TOGGLE_FORMAT) {
      compact = !compact; // toggle compact view
      printRaw = false; // reset printRaw when toggling format
    }

    printRaw = viewAction === ViewAction.TOGGLE_RAW ? !printRaw : printRaw;
    const exportToFile = !!opts.export || viewAction === ViewAction.EXPORT;

    if (
      viewAction !== ViewAction.TOGGLE_FORMAT &&
      viewAction !== ViewAction.TOGGLE_RAW &&
      viewAction !== ViewAction.EXPORT  
    ) {
      // Get history only if not toggling view or exporting (i.e. changing page)
      history = await wallet.client.getTxHistory({
        includeExtendedInfo: true,
        tokenAddress: tokenObj?.contractAddress,
        limit: opts.pageSize,
        skip: (page - 1) * opts.pageSize
      });
    }

    const extraChoices = [
      compact ? { value: ViewAction.TOGGLE_FORMAT, label: 'Expand format' } : { value: ViewAction.TOGGLE_FORMAT, label: 'Compact format' },
      printRaw ? { value: ViewAction.TOGGLE_RAW, label: 'Print pretty' } : { value: ViewAction.TOGGLE_RAW, label: 'Print raw tx objects' },
      { value: ViewAction.EXPORT, label: 'Export to file' }
    ];

    if (exportToFile) {
      const d = new Date();
      const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const defaultValue = `~/${wallet.name}_txhistory_${dateStr}_${page}.json`;
      const outputFile = opts.command
        ? Utils.replaceTilde(typeof opts.export === 'string' ? opts.export : defaultValue)
        : await getFileName({
          message: 'Enter output file path to save proposal:',
          defaultValue,
        });

      await fs.promises.writeFile(outputFile, JSON.stringify(history, null, 2));
      prompt.log.info(`Page ${page} exported to: ${outputFile}`);
    } else if (printRaw) {
      prompt.log.info(`Raw Tx History:${os.EOL}` + JSON.stringify(history, null, 2));
    } else {

      const lines = [];
      let sum = 0;
      for (const tx of history) {
        const timestamp = new Date(tx.time * 1000);
        const time = compact ? Utils.formatDateCompact(timestamp) : Utils.formatDate(timestamp);
        const txid = compact ? Utils.compactString(tx.txid) : tx.txid;
        tokenObj = tokenObj && !compact ? { ...tokenObj, precision: tokenObj.decimals.short.maxDecimals } : tokenObj;
        const amount = Utils.renderAmount(currency, tx.amount, tokenObj);
        const confirmations = tx.confirmations || 0;
        let direction = '';
        let contractCall = false;

        switch (tx.action) {
          case 'received':
            if (!tx.amount && tx.effects?.length && !tokenObj) {
              // Received token (or something...NFT?). Skip it
              continue;
            }
            direction = '<=';
            sum = sum + tx.amount;
            break;
          case 'moved':
            direction = '==';
            sum = sum - tx.fees;
            break;
          case 'sent':
            direction = '=>';
            sum = sum - tx.amount - tx.fees;
            contractCall = !tx.amount && tx.effects?.length > 0;
            break;
        }

        const action = compact ? '' : ` ${tx.action}`;

        if (tx.size) { // utxo
          lines.push(`[${time}] ${txid} ${direction}${action} ${amount} (${(tx.fees / tx.size).toFixed(2)} sats/b) (${confirmations} confs)`);
        } else {
          const contractStr = !contractCall ? '' : compact ? '*' : ' [Contract*]';
          lines.push(`[${time}] ${txid} ${direction}${action} ${amount}${contractStr} (${tx.fees} fee) (${confirmations} confs)`);
        }
      }

      prompt.note(lines.join(os.EOL), `Tx History (page ${page})`);
    }

    if (opts.command) {
      return { result: [] }; // Don't wait for user input in CLI mode
    }
    return { result: history, extraChoices };
  }, {
    pageSize: opts.pageSize,
    initialPage: opts.page,
    exitOn1Page: !!opts.command
  });

  return { action: 'menu' };
};
