import * as BitcoreLib from 'bitcore-lib';
import * as BitcoreLibCash from 'bitcore-lib-cash';
import * as LitcoreLib from 'litecore-lib';
import Web3 from 'web3';
import Deriver from './derivation';
import Transactions from './transactions';
import Validation from './validation';
const Libs = { BTC: BitcoreLib, BCH: BitcoreLibCash, LTC: LitcoreLib };
export {
  BitcoreLib,
  BitcoreLibCash,
  Deriver,
  Transactions,
  Validation,
  Web3,
  Libs
};
