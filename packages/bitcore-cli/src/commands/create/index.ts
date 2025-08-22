import { Constants } from 'crypto-wallet-core';
import type { CommonArgs } from '../../../types/cli';
import { getChain, getIsMultiParty, getMofN, getMultiPartyScheme, getNetwork } from '../../prompts';
import { Utils } from '../../utils';
import { createMultiSigWallet } from './createMultiSig';
import { createSingleSigWallet } from './createSingleSig';
import { createThresholdSigWallet } from './createThresholdSig';

export async function createWallet(args: CommonArgs<{ mnemonic?: string }>) {
  const { wallet, opts } = args;

  await wallet.getClient({});

  const chain = await getChain();
  const network = await getNetwork();
  const isMultiParty = await getIsMultiParty();

  let mnemonic;
  if (!isMultiParty) {
    ({ mnemonic } = await createSingleSigWallet({ wallet, chain, network, opts }));
  } else {
    let useTss = true;
    if (Constants.MULTISIG_CHAINS.includes(chain)) {
      const scheme = await getMultiPartyScheme();
      useTss = scheme === 'tss';
    }

    const mOfN = await getMofN();
    const [m, n] = Utils.parseMN(mOfN);

    if (useTss) {
      ({ mnemonic } = await createThresholdSigWallet({ wallet, chain, network, opts, m, n }));
    } else {
      ({ mnemonic} = await createMultiSigWallet({ wallet, chain, network, opts, m, n }));
    }
  }
  
  // Re-fetch the client to ensure it has the latest state
  // and to complete the wallet creation process

  await wallet.getClient({});

  if (!opts.mnemonic) {
    await Utils.showMnemonic(wallet.name, mnemonic, opts);
  }
};