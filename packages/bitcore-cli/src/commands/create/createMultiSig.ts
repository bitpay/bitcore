import * as prompt from '@clack/prompts';
import { Network } from 'bitcore-wallet-client';
import os from 'os';
import { getAddressType, getCopayerName, getPassword } from '../../prompts';
import { Utils } from '../../utils';
import { Wallet } from '../../wallet';
import { ICliOptions } from '../../../types/cli';

export async function createMultiSigWallet(args: {
  wallet: Wallet;
  chain: string;
  network: Network;
  m: number;
  n: number;
  opts: ICliOptions & {
    mnemonic?: string;
  };
}) {
  const { wallet, chain, network, m, n, opts } = args;
  const { verbose, mnemonic } = opts;

  const copayerName = await getCopayerName();
  const addressType = await getAddressType({ chain, network, isMultiSig: true });
  const password = await getPassword('Enter a password for the wallet:', { hidden: false });
  
  const { key, secret } = await wallet.create({ chain, network, account: 0, n, m, password, mnemonic, addressType, copayerName });

  prompt.log.success(Utils.colorText(`${chain.toUpperCase()} ${network} wallet created`, 'green'));
  verbose && prompt.log.step(`Wallet file saved to: ${Utils.colorText(wallet.filename, 'blue')}`);

  await prompt.select({
    message: `Share this secret with the other participants:${os.EOL}${Utils.colorText(secret, 'blue')}`,
    options: [{ label: 'Done', value: true, hint: 'Hit Enter/Return to continue' }]
  });

  return {
    mnemonic: key.get(password).mnemonic,
  }
}
