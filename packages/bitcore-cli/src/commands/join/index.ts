import * as prompt from '@clack/prompts';
import { Constants } from 'crypto-wallet-core';
import { getChain } from '../../prompts';
import { Utils } from '../../utils';
import { joinMultiSigWallet } from './joinMultiSig';
import { joinThresholdSigWallet } from './joinThresholdSig';
import type { CommonArgs } from '../../../types/cli';


export async function joinWallet(args: CommonArgs<{ mnemonic?: string }>) {
  const { wallet, opts } = args;

  const chain = await getChain();

  let useTss = true;
  if (Constants.MULTISIG_CHAINS.includes(chain)) {
    const scheme = await prompt.select({
      message: 'Which scheme is the wallet?',
      options: [
        {
          label: 'MultiSig - On-chain Multi-Signature Scheme',
          value: 'multisig',
          hint: 'Easier setup and backup (only need 12 words). Higher transaction fees.'
        },
        {
          label: 'TSS - Threshold Signature Scheme',
          value: 'tss',
          hint: 'More complicated setup and backup. Lower transaction fees.'
        },
      ],
      initialValue: process.env['BITCORE_CLI_MULTISIG_SCHEME'] || 'multisig',
    });
    useTss = scheme === 'tss';
  }

  let mnemonic;
  if (useTss) {
    ({ mnemonic } = await joinThresholdSigWallet(Object.assign({}, args, { chain })));
  } else {
    ({ mnemonic } = await joinMultiSigWallet(args));
  }

  if (!opts.mnemonic) {
    await Utils.showMnemonic(wallet.name, mnemonic, opts);
  }
};