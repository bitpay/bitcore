import fs from 'fs';
import os from 'os';
import * as prompt from '@clack/prompts';
import { ITokenObj } from '../../types/wallet';
import { UserCancelled } from '../errors';
import { getFileName } from '../prompts';
import { Utils } from '../utils';
import type { CommonArgs } from '../../types/cli';

export function command(args: CommonArgs) {
  const { wallet, program } = args;
  program
    .description('View or perform actions on transaction proposals for a wallet')
    .usage('<walletName> --command txproposals [options]')
    .optionsGroup('Tx Proposals Options')
    .option('--action <action>', 'Action to perform on transaction proposals: sign, reject, delete, broadcast')
    .option('--proposalId <proposalId>', 'ID of the transaction proposal to act upon')
    .option('--page <page>', 'Page number to view (only 1 proposal is displayed per page)')
    .option('--raw', 'Print raw transaction proposal objects instead of formatted output')
    .option('--export [filename]', `Export the transaction proposal(s) to a file(s) (default: ~/${wallet.name}_txproposal_<proposalId>.json)`)
    .parse(process.argv);

  const opts = program.opts();
  if (opts.help) {
    program.help();
  }

  if (!!opts.action !== !!opts.proposalId) {
    throw new Error('Both --action and --proposalId options must be provided together.');
  }
  if (!!opts.proposalId === !!opts.page) {
    throw new Error('--page option does not make sense with --proposalId.');
  }
  return opts;
}


export async function getTxProposals(
  args: CommonArgs<{
    action?: string;
    proposalId?: string;
    raw?: boolean;
    export?: string | boolean;
    page?: number | string;
  }>
) {
  const { wallet, opts } = args;
  if (opts.command) {
    Object.assign(opts, command(args));
  }
  
  const myCopayerId = wallet.client.credentials.copayerId;

  const txps = opts.command && opts.proposalId
    ? [await wallet.client.getTx(opts.proposalId)]
    : await wallet.client.getTxProposals({
      forAirGapped: false, // TODO
    });

  enum ViewAction {
    ACCEPT = 'a',
    REJECT = 'j',
    BROADCAST = 'b',
    DELETE = 'd',
    TOGGLE_RAW = 'r',
    EXPORT = 'e'
  }

  let lastPage = 1;
  let printRaw = opts.raw ?? false;
  let txp;

  await Utils.paginate(async (page, action) => {
    const i = page - 1;
    txp = txps[i];

    if (!txp) {
      prompt.log.info('No more proposals');
      return { result: [] };
    }

    const _txps = page < txps.length ? [txp] : [txp, { /* This element will prevent the paginator from showing Next Page option */}];

    if (action === ViewAction.TOGGLE_RAW) {
      printRaw = !printRaw;
    } else if (lastPage !== page) {
      printRaw = false; // reset to formatted view when changing pages
    }
    lastPage = page;

    
    if (action === ViewAction.ACCEPT) {
      txps[i] = await wallet.signAndBroadcastTxp({ txp });
      txp = txps[i];
      if (txp.status === 'broadcasted') {
        prompt.log.success(`Broadcasted txid: ${Utils.colorText(txp.txid, 'green')}`);
      } else {
        prompt.log.info(`Proposal ${txp.id} signed. More signatures needed to broadcast.`);
      }
      
    } else if (action === ViewAction.REJECT) {
      const rejectReason = await prompt.text({ message: 'Enter rejection reason:' });
      if (prompt.isCancel(rejectReason)) {
        throw new UserCancelled();
      }
      txps[i] = await wallet.client.rejectTxProposal(txp, rejectReason);
      txp = txps[i];

    } else if (action === ViewAction.BROADCAST) {
      txps[i] = await wallet.client.broadcastTxProposal(txp);
      if (txps[i].status === 'broadcasted') {
        prompt.log.success(`Broadcasted txid: ${Utils.colorText(txp.txid, 'green')}`);
      }
      txp = txps[i];

    } else if (action === ViewAction.DELETE) {
      const confirmDelete = await prompt.confirm({
        message: `Are you sure you want to delete proposal ${txp.id}?`,
        initialValue: false
      });
      if (prompt.isCancel(confirmDelete)) {
        throw new UserCancelled();
      }
      if (confirmDelete) {
        await wallet.client.removeTxProposal(txp);
        txps[i].status = 'deleted'; // Update status locally since it's removed from server

        prompt.log.success(`Proposal ${txp.id} deleted.`);
      } else {
        prompt.log.step(`Proposal ${txp.id} not deleted.`);
      }

    } else if (action === ViewAction.EXPORT) {
      const defaultValue = `~/${wallet.name}_txproposal_${txp.id}.json`;
      const outputFile = opts.command
        ? Utils.replaceTilde(typeof opts.export === 'string' ? opts.export : defaultValue)
        : await getFileName({
          message: 'Enter output file path to save proposal:',
          defaultValue,
        });
      fs.writeFileSync(outputFile, JSON.stringify(txp, null, 2));
      prompt.log.success(`Exported to ${outputFile}`);

    } else if (printRaw) {
      prompt.log.info(`ID: ${txp.id}` + os.EOL + JSON.stringify(txp, null, 2));
    
    } else {
      const lines = [];
      const chain = txp.chain || txp.coin;
      const network = txp.network;
      let tokenObj: ITokenObj;
      if (txp.tokenAddress) {
        tokenObj = await wallet.getToken({ tokenAddress: txp.tokenAddress });
        if (!tokenObj) {
          throw new Error(`Unknown token "${txp.tokenAddress}" on ${chain}:${network}`);
        }
      }
      const nativeCurrency = (await wallet.getNativeCurrency(true)).displayCode;
      const currency = tokenObj?.displayCode || nativeCurrency;

      lines.push(`Chain: ${chain.toUpperCase()}`);
      lines.push(`Network: ${Utils.capitalize(txp.network)}`);
      txp.tokenAddress && lines.push(`Token: ${txp.tokenAddress}`);
      lines.push(`Amount: ${Utils.renderAmount(currency, txp.amount, tokenObj)}`);
      lines.push(`Fee: ${Utils.renderAmount(nativeCurrency, txp.fee)}`);
      // lines.push(`Total Amount: ${Utils.amountFromSats(chain, txp.amount + txp.fee)} ${currency}`);
      lines.push(`Total Amount: ${tokenObj 
        ? Utils.renderAmount(currency, txp.amount, tokenObj) + ` + ${Utils.renderAmount(nativeCurrency, txp.fee)}`
        : Utils.renderAmount(currency, txp.amount + txp.fee)
      }`);
      txp.gasPrice && lines.push(`Gas Price: ${Utils.displayFeeRate(chain, txp.gasPrice)}`);
      txp.gasLimit && lines.push(`Gas Limit: ${txp.gasLimit}`);
      txp.feePerKb && lines.push(`Fee Rate: ${Utils.displayFeeRate(chain, txp.feePerKb)}`);
      txp.nonce != null && lines.push(`Nonce: ${txp.nonce}`);
      lines.push(`Status: ${txp.status}`);
      lines.push(`Creator: ${txp.creatorName}`);
      lines.push(`Created: ${Utils.formatDate(txp.createdOn * 1000)}`);
      txp.message && lines.push(`Message: ${txp.message}`);

      lines.push('---------------------------');
      lines.push('Recipients:');
      lines.push(...txp.outputs.map(o => {
        return ` → ${Utils.maxLength(o.toAddress)}${o.tag ? `:${o.tag}` : ''}: ${Utils.renderAmount(currency, o.amount)}${o.message ? ` (${o.message})` : ''}`;
      }));
      txp.changeAddress && lines.push(` ↲ ${Utils.maxLength(txp.changeAddress.address)} (change - ${txp.changeAddress.path})`);
      lines.push('---------------------------');
      if (txp.actions?.length) {
        lines.push('Actions:');
        lines.push(...txp.actions.map(a => {
          return ` → ${a.copayerName}: ${a.type}${a.comment ? ` "${a.comment}"` : ''}${a.createdOn ? ` (${Utils.formatDate(a.createdOn * 1000)})` : ''}`;
        }));
        lines.push('---------------------------');
      }
      
      if (txp.txid) {
        lines.push(`Txid: ${Utils.colorText(txp.txid, 'green')}`);
      } else {
        const missingSigsCnt = txp.requiredSignatures - txp.actions.filter(a => a.type === 'accept').length;
        lines.push(Utils.colorText(`Missing Signatures: ${missingSigsCnt}`, missingSigsCnt ? 'yellow' : 'green'));
      }
      prompt.note(lines.join(os.EOL), `ID: ${txp.id}`);
    }

    if (opts.command) {
      return {}; // Don't wait for user input in CLI mode
    }

    const extraChoices = []
      .concat(
        txp.status !== 'broadcasted' && !txp.actions.find(a => a.copayerId === myCopayerId) && txp.status !== 'deleted' ? [
          { label: 'Accept', value: ViewAction.ACCEPT, hint: 'Accept and sign this proposal' },
          { label: 'Reject', value: ViewAction.REJECT, hint: 'Reject this proposal' },
        ] : []
      ).concat(
        txp.status !== 'broadcasted' && txp.actions.filter(a => a.type === 'accept').length >= txp.requiredSignatures && txp.status !== 'deleted' ? [
          { label: 'Broadcast', value: ViewAction.BROADCAST, hint: 'Broadcast this proposal' }
        ] : []
      ).concat(
        txp.status !== 'broadcasted' && txp.status !== 'rejected' && txp.status !== 'deleted' ? [
          { label: 'Delete', value: ViewAction.DELETE, hint: 'Delete this proposal' }
        ] : []
      ).concat([
        printRaw ? { label: 'Print Pretty', value: ViewAction.TOGGLE_RAW, hint: 'Print formatted proposal' } : { label: 'Print Raw Object', value: ViewAction.TOGGLE_RAW, hint: 'Print raw proposal object' },
        { label: 'Export', value: ViewAction.EXPORT, hint: 'Save to a file' },
      ]);

    return { result: _txps, extraChoices };
  }, {
    pageSize: 1,
    initialPage: opts.page,
    exitOn1Page: !!opts.command
  });

  return { action: 'menu' };
};