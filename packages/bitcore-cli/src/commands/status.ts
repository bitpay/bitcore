import * as prompt from '@clack/prompts';
import { Status } from 'bitcore-wallet-client';
import moment from 'moment';
import os from 'os';
import { Utils } from '../utils';
import { Wallet } from '../wallet';
import { displayBalance } from './balance';

export async function walletStatus(args: {
  wallet: Wallet;
  opts: {
    verbose: boolean;
    tokenName?: string;
  }
}) {
  const { wallet, opts } = args;
  const { tokenName } = opts;
  
  const status: Status = await wallet.client.getStatus({});
  const w = status.wallet;

  const statusLines = [`ID: ${w.id}`];
  statusLines.push(`${w.coin.toUpperCase()} ${Utils.capitalize(w.network)}`);
  statusLines.push(`${w.m}-of-${w.n}${w.tssKeyId ? ' (TSS)' : ''}${w.singleAddress ? ' single-address' : ''} [${w.derivationStrategy} ${w.addressType}]`);
  statusLines.push(`Status: ${Utils.renderStatus(w.status)}`);
  statusLines.push(`Created on: ${moment(w.createdOn * 1000)}`);


  if (w.status !== 'complete') {
    statusLines.push('');
    statusLines.push(`Missing ${(w.n - w.copayers.length)} copayers`);
    statusLines.push(`Secret: ${Utils.colorText(w.secret, 'yellow')}`);
  }

  prompt.note(statusLines.join(os.EOL), `${tokenName ? '(Linked) ' : ''}Wallet info`);

  displayBalance(status.balance, w.coin, Object.assign({}, opts, { showByAddress: false }));

  if (status.pendingTxps?.length) {
    prompt.log.warn(Utils.colorText(`${status.pendingTxps?.length} pending tx proposals`, 'yellow'));
  } else {
    prompt.log.info('No pending tx proposals');
  }

  return status;
};
