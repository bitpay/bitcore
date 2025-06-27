import * as prompt from '@clack/prompts';
import os from 'os';
import { Utils } from '../utils';
import { Wallet } from '../wallet';

export async function getBalance(args: {
  wallet: Wallet;
  opts: {
    verbose: boolean;
    tokenAddress?: string;
  }
}) {
  const { wallet, opts } = args;
  if (!wallet.isComplete()) {
    prompt.log.warn('Wallet is not complete. Check the wallet status for more details.');
    return {};
  }
  const bal = await wallet.client.getBalance(opts);
  const coin = wallet.client.credentials.coin;
  displayBalance(bal, coin);
  
  return bal;
};

export function displayBalance(bal, coin, opts?) {
  const format = (amount) => Utils.renderAmount(amount, coin, opts);

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

  prompt.note(lines.join(os.EOL), `${coin.toUpperCase()} Balance ${opts?.contractAddress ? `(${opts.code} - ${opts.contractAddress})` : ''}`);
}