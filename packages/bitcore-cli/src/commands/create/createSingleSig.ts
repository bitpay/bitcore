import * as prompt from '@clack/prompts';
import { getAddressType, getPassword } from '../../prompts';
import type { CommonArgs } from '../../../types/cli';
import { type Network } from 'bitcore-wallet-client';
import { Utils } from '../../utils';

export async function createSingleSigWallet(
  args: CommonArgs<{ mnemonic?: string }> & {
    chain: string;
    network: Network;
  }
) {
  const { wallet, chain, network, opts } = args;
  const { verbose, mnemonic } = opts;

  const addressType = await getAddressType({ chain, network });
  const password = await getPassword('Enter a password for the wallet:', { hidden: false });
  const copayerName = process.env.USER || 'copayer';

  const { key } = await wallet.create({
    chain,
    network,
    account: 0,
    m: 1,
    n: 1,
    password,
    mnemonic,
    addressType,
    copayerName
  });

  prompt.log.success(Utils.colorText(`${chain.toUpperCase()} ${network} wallet created`, 'green'));
  verbose && prompt.log.step(`Wallet file saved to: ${Utils.colorText(wallet.filename, 'blue')}`);
  
  return {
    mnemonic: key.get(password).mnemonic,
  };
}
