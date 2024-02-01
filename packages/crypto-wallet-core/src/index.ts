import * as BitcoreLib from 'bitcore-lib';
import * as BitcoreLibCash from 'bitcore-lib-cash';
import * as BitcoreLibDoge from 'bitcore-lib-doge';
import * as BitcoreLibLtc from 'bitcore-lib-ltc';
import { ethers } from 'ethers';
import Web3 from 'web3';
import xrpl from 'xrpl';
import { Constants } from './constants';
import Deriver from './derivation';
import Transactions from './transactions';
import Validation from './validation';
export {
  BitcoreLib,
  BitcoreLibCash,
  BitcoreLibDoge,
  BitcoreLibLtc,
  Deriver,
  Transactions,
  Validation,
  ethers,
  Web3,
  Constants,
  xrpl
};
