import * as prompt from '@clack/prompts';
import { getAction, getFileName } from '../prompts';
import type { CommonArgs } from '../../types/cli';
import fs from 'fs';
import os from 'os';
import { UserCancelled } from '../errors';
import { Utils } from '../utils';

export function command(args: CommonArgs) {
  const { wallet, program } = args;
  program
    .description('View, sign, and reject transaction proposals for a wallet')
    .usage('<walletName> --command txproposals [options]')
    .optionsGroup('Tx Proposals Options')
    .option('--action <action>', 'Action to perform on transaction proposals: sign, reject, delete, broadcast')
    .option('--proposalId <proposalId>', 'ID of the transaction proposal to act upon')
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
  return opts;
}


export async function getTxProposals(
  args: CommonArgs<{
    action?: string;
    proposalId?: string;
    raw?: boolean;
    export?: string | boolean;
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

  let action: string | symbol | undefined;
  let i = 0;
  let printRaw = opts.raw ?? false;

  do {
    const txp = txps[i];
    if (!txp) {
      prompt.log.info('No more proposals');
    } else if (printRaw) {
      prompt.log.info(`ID: ${txp.id}` + os.EOL + JSON.stringify(txp, null, 2));
    } else {
      const lines = [];
      const chain = txp.chain || txp.coin;
      const currency = chain.toUpperCase();
      const feeCurrency = currency; // TODO

      lines.push(`Chain: ${chain.toUpperCase()}`);
      lines.push(`Network: ${Utils.capitalize(txp.network)}`);
      txp.tokenAddress && lines.push(`Token: ${txp.tokenAddress}`);
      lines.push(`Amount: ${Utils.amountFromSats(chain, txp.amount)} ${currency}`);
      lines.push(`Fee: ${Utils.amountFromSats(chain, txp.fee)} ${feeCurrency}`);
      lines.push(`Total Amount: ${Utils.amountFromSats(chain, txp.amount + txp.fee)} ${currency}`);
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
        return ` → ${Utils.maxLength(o.toAddress)}${o.tag ? `:${o.tag}` : ''}: ${Utils.amountFromSats(chain, o.amount)} ${currency}${o.message ? ` (${o.message})` : ''}`;
      }));
      txp.changeAddress && lines.push(`Change Address: ${Utils.maxLength(txp.changeAddress.address)} (${txp.changeAddress.path})`);
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

    const options = [];
    let initialValue;

    if (txp) {
      if (txp.status !== 'broadcasted' && !txp.actions.find(a => a.copayerId === myCopayerId)) {
        options.push({ label: 'Accept', value: 'accept', hint: 'Accept and sign this proposal' });
        options.push({ label: 'Reject', value: 'reject', hint: 'Reject this proposal' });
        initialValue = 'accept';
      }
      if (txp.status !== 'broadcasted' && txp.actions.filter(a => a.type === 'accept').length >= txp.requiredSignatures) {
        options.push({ label: 'Broadcast', value: 'broadcast', hint: 'Broadcast this proposal' });
        initialValue = 'broadcast';
      }
      if (i > 0) {
        options.push({ label: 'Previous', value: 'prev' });
        initialValue = 'prev';
      }
      if (i < txps.length - 1) {
        options.push({ label: 'Next', value: 'next' });
        initialValue = 'next';
      }
      if (printRaw) {
        options.push({ label: 'Print Pretty', value: 'pretty' });
      } else {
        options.push({ label: 'Print Raw Object', value: 'raw' });
      }
      if (txp.status !== 'broadcasted') {
        options.push({ label: 'Delete', value: 'delete', hint: 'Delete this proposal' });
      }
      options.push({ label: 'Export', value: 'export', hint: 'Save to a file' });
    }

    action = opts.command
      ? opts.action || (opts.export ? 'export' : 'exit')
      : await getAction({
        options,
        initialValue
      });
    if (prompt.isCancel(action)) {
      throw new UserCancelled();
    }

    switch (action) {
      case 'accept':
        txps[i] = await wallet.signAndBroadcastTxp({ txp });
        if (txps[i].status === 'broadcasted') {
          prompt.log.success(`Proposal ${txp.id} broadcasted.`);
        } else {
          prompt.log.info(`Proposal ${txps[i].id} signed. More signatures needed to broadcast.`);
        }
        break;
      case 'reject':
        const rejectReason = await prompt.text({
          message: 'Enter rejection reason:'
        });
        if (prompt.isCancel(rejectReason)) {
          throw new UserCancelled();
        }
        txps[i] = await wallet.client.rejectTxProposal(txp, rejectReason);
        break;
      case 'broadcast':
        txps[i] = await wallet.client.broadcastTxProposal(txp);
        if (txps[i].status === 'broadcasted') {
          prompt.log.success(`Proposal ${txp.id} broadcasted.`);
        }
        break;
      case 'prev':
        i--;
        printRaw = false;
        break;
      case 'next':
        i++;
        printRaw = false;
        break;
      case 'raw':
      case 'pretty':
        printRaw = !printRaw;
        break;
      case 'delete':
        const confirmDelete = await prompt.confirm({
          message: `Are you sure you want to delete proposal ${txp.id}?`,
          initialValue: false
        });
        if (prompt.isCancel(confirmDelete)) {
          throw new UserCancelled();
        }
        if (confirmDelete) {
          await wallet.client.removeTxProposal(txp);
          txps.splice(i, 1);
          if (i >= txps.length) {
            i = txps.length - 1; // adjust index if we deleted the last item
          }
          prompt.log.success(`Proposal ${txp.id} deleted.`);
        } else {
          prompt.log.step(`Proposal ${txp.id} not deleted.`);
        }
        break;
      case 'export':
        const defaultValue = `~/${wallet.name}_txproposal_${txp.id}.json`;
        const outputFile = opts.command
          ? Utils.replaceTilde(typeof opts.export === 'string' ? opts.export : defaultValue)
          : await getFileName({
            message: 'Enter output file path to save proposal:',
            defaultValue,
          });
        fs.writeFileSync(outputFile, JSON.stringify(txp, null, 2));
        prompt.log.success(`Exported to ${outputFile}`);
        break;
      case 'menu':
      case 'exit':
        break;
      default:
        if (opts.command) throw new Error(`Unknown action: ${action}`);
    }

    if (opts.command) {
      action = 'exit'; // Exit after processing the action in command mode
    }
    // TODO: handle actions
  } while (!['menu', 'exit'].includes(action));

  return { action };
};