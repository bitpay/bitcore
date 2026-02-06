import os from 'os';
import { Status } from '@bitpay-labs/bitcore-wallet-client';
import * as prompt from '@clack/prompts';
import { Utils } from '../utils';
import { displayBalance } from './balance';
import type { CommonArgs } from '../../types/cli';
import type { ITokenObj } from '../../types/wallet';

export async function command(args: CommonArgs) {
  const { program } = args;
  program
    .description('Show wallet status')
    .usage('<walletName> --command status [options]')
    .option('--token <token>', 'Token to get the balance for (e.g. USDC)')
    .option('--tokenAddress <address>', 'Token contract address to get the balance for')
    .parse(process.argv);

  const opts = program.opts();
  if (opts.help) {
    program.help();
  }

  return opts;
}

export async function walletStatus(args: CommonArgs) {
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

  const status: Status = await wallet.client.getStatus({ tokenAddress: tokenObj?.contractAddress });
  const w = status.wallet;

  const statusLines = [`ID: ${w.id}`];
  statusLines.push(`${w.chain.toUpperCase()} ${Utils.capitalize(w.network)}`);
  statusLines.push(`${w.m}-of-${w.n}${w.tssKeyId ? ' (TSS)' : ''}${w.singleAddress ? ' single-address' : ''} [${w.derivationStrategy} ${w.addressType}]`);
  statusLines.push(`Status: ${Utils.renderStatus(w.status)}`);
  statusLines.push(`Created on: ${Utils.formatDate(w.createdOn * 1000)}`);


  if (w.status !== 'complete') {
    statusLines.push('');
    statusLines.push(`Missing ${(w.n - w.copayers.length)} copayers`);
    statusLines.push(`Secret: ${Utils.colorText(w.secret, 'yellow')}`);
  }

  prompt.note(statusLines.join(os.EOL), `${tokenObj ? '(Linked) ' : ''}Wallet info`);

  const currency = tokenObj?.displayCode || w.coin;
  displayBalance(currency, status.balance, Object.assign({ showByAddress: false }, tokenObj));

  if (status.pendingTxps?.length) {
    prompt.log.warn(Utils.colorText(`${status.pendingTxps?.length} pending tx proposals`, 'yellow'));
  } else {
    prompt.log.info('No pending tx proposals');
  }

  return status;
};
