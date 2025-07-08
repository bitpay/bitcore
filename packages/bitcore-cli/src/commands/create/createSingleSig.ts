import * as prompt from '@clack/prompts';
import { Network } from 'bitcore-wallet-client';
import { ICliOptions } from '../../../types/cli';
import { getAddressType, getPassword } from '../../prompts';
import { Utils } from '../../utils';
import { Wallet } from '../../wallet';

export async function createSingleSigWallet(args: {
  wallet: Wallet;
  chain: string;
  network: Network;
  opts: ICliOptions & {
    mnemonic?: string;
  }
}) {
  const { wallet, chain, network, opts } = args;
  const { verbose, mnemonic } = opts;

  const addressType = await getAddressType({ chain, network });
  const password = await getPassword('Enter a password for the wallet:', { hidden: false });
  const copayerName = process.env.USER;

  const { key } = await wallet.create({
    chain,
    network,
    account: 0,
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
  }
}
