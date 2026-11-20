import * as prompt from '@clack/prompts';
import * as prompts from '../prompts';
import { Utils } from '../utils';
import type { CommonArgs } from '../../types/cli';


export async function createSiblingWallet(args: CommonArgs) {
  const { wallet } = args;

  const chain = await prompts.getChain();
  const network = await prompts.getNetwork(wallet.network);
  if (chain === wallet.chain && network === wallet.network) {
    prompt.log.error('A sibling wallet must be on a different chain or network than this wallet');
    return;
  }

  const walletName = `${wallet.name}_${chain}` + (network !== wallet.network ? `_${network}` : '');
  prompt.log.info('Creating sibling wallet...');
  await wallet.createSiblingWallet({ walletName, chain, network });
  prompt.log.success(`Sibling wallet ${Utils.colorText(walletName, 'blue')} created in ${wallet.dir}`);
};
