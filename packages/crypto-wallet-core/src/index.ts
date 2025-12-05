import * as SolKit from '@solana/kit';
import * as ComputeBudget from '@solana-program/compute-budget';
import * as Memo from '@solana-program/memo';
import * as System from '@solana-program/system';
import * as Token from '@solana-program/token';
import * as BitcoreLib from 'bitcore-lib';
import * as BitcoreLibCash from 'bitcore-lib-cash';
import * as BitcoreLibDoge from 'bitcore-lib-doge';
import * as BitcoreLibLtc from 'bitcore-lib-ltc';
import * as HDKey from 'ed25519-hd-key';
import { ethers } from 'ethers';
import Web3 from 'web3';
import * as xrpl from 'xrpl';
import { Constants } from './constants';
import Deriver from './derivation';
import Message from './message';
import Transactions from './transactions';
import * as Utils from './utils';
import Validation from './validation';

export type * as Types from './types';
const SolanaProgram = {
  ComputeBudget,
  Memo,
  System,
  Token,
  HDKey
};
export {
  BitcoreLib,
  BitcoreLibCash,
  BitcoreLibDoge,
  BitcoreLibLtc,
  Deriver,
  Message,
  Transactions,
  Validation,
  ethers,
  Web3,
  SolKit,
  SolanaProgram,
  Constants,
  xrpl,
  Utils
};
