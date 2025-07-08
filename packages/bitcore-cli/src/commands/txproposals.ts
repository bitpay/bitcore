import * as prompt from '@clack/prompts';
import { Status, Txp } from 'bitcore-wallet-client';
import fs from 'fs';
import moment from 'moment';
import os from 'os';
import { ICliOptions } from '../../types/cli';
import { UserCancelled } from '../errors';
import { getAction } from '../prompts';
import { Utils } from '../utils';
import { Wallet } from '../wallet';

export async function getTxProposals(args: {
  wallet: Wallet;
  status: Status
  opts: ICliOptions & {
    pageSize: number;
  }
}) {
  const { wallet, opts } = args;
  const myCopayerId = wallet.client.credentials.copayerId;

  const txps = await wallet.client.getTxProposals({
    forAirGapped: false, // TODO
    // limit: pageSize,
    // skip: (page - 1) * pageSize
  });

  let action: string | symbol | undefined;
  let i = 0;
  let printRaw = false;

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
      lines.push(`Created: ${moment(txp.createdOn * 1000)}`);
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
          return ` → ${a.copayerName}: ${a.type}${a.comment ? ` "${a.comment}"` : ''}${a.createdOn ? ` (${moment(a.createdOn * 1000)})` : ''}`;
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

    action = await getAction({
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
        const outputFile = await prompt.text({
          message: 'Enter output file path to save proposal:',
          initialValue: `./${txp.id}.json`,
          validate: (value) => {
            if (!value) return 'Output file path is required';
            return; // valid value
          }
        });
        if (prompt.isCancel(outputFile)) {
          throw UserCancelled;
        }
        fs.writeFileSync(outputFile, JSON.stringify(txp, null, 2));
        break;
    }

    // TODO: handle actions
  } while (!['menu', 'exit'].includes(action))

  return { action };
};