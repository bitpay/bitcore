import * as prompt from '@clack/prompts';
import os from 'os';
import type { CommonArgs } from '../../types/cli';
import type { ITokenObj } from '../../types/wallet';
import { Utils } from '../utils';

export function command(args: CommonArgs) {
  const { program } = args;
  program
    .description('Get the balance of the wallet')
    .usage('<walletName> --command balance [options]')
    .optionsGroup('Balance Options')
    .option('--token <token>', 'Token to get the balance for (e.g. USDC)')
    .option('--tokenAddress <address>', 'Token contract address to get the balance for')
    .option('--showByAddress', 'Show balance by address', false)
    .parse(process.argv);
  
  const opts = program.opts();
  if (opts.help) {
    program.help();
  }
  return opts;
}

export async function getBalance(args: CommonArgs<{
  showByAddress?: boolean;
}>) {
  const { wallet, opts } = args;
  if (opts.command) {
    Object.assign(opts, command(args));
  }
  if (!wallet.isComplete()) {
    prompt.log.warn('Wallet is not complete. Check the wallet status for more details.');
    return {};
  }

  let tokenObj: ITokenObj;
  if (opts.token || opts.tokenAddress) {
    tokenObj = await wallet.getToken(opts);
    if (!tokenObj) {
      throw new Error(`Unknown token "${opts.tokenAddress || opts.token}" on ${wallet.chain}:${wallet.network}`);
    }
  }

  const bal = await wallet.client.getBalance({ tokenAddress: tokenObj?.contractAddress });
  const currency = tokenObj?.displayCode || wallet.client.credentials.coin;
  displayBalance(currency, bal, Object.assign({ showByAddress: opts.showByAddress }, tokenObj));

  return bal;
};

export function displayBalance(currency, bal, opts?) {
  const format = (amount) => Utils.renderAmount(currency, amount, opts);

  const lines = [`Total: ${format(bal.totalAmount)} (${format(bal.lockedAmount)} locked)`];
  lines.push(`Confirmed: ${format(bal.totalConfirmedAmount)} (${format(bal.lockedConfirmedAmount)} locked)`);
  lines.push(`Available: ${format(bal.availableAmount)} (${format(bal.availableConfirmedAmount)} confirmed / ${format(bal.availableAmount - bal.availableConfirmedAmount)} unconfirmed)`);

  
  if (opts?.showByAddress && bal.byAddress?.length > 0) {
    lines.push('');
    lines.push('By address:');

    for (const item of bal.byAddress) {
      lines.push(`  ${item.address} (${item.path}): ${format(item.amount)}`);
    }
  }

  prompt.note(lines.join(os.EOL), `${currency.toUpperCase()} Balance ${opts?.contractAddress ? `(${opts.code} - ${opts.contractAddress})` : ''}`);
}