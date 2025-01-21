import * as BitcoreLib from '@bcpros/bitcore-lib';
import * as BitcoreLibCash from '@bcpros/bitcore-lib-cash';
import * as BitcoreLibDoge from '@bcpros/bitcore-lib-doge';
import * as BitcoreLibLtc from '@bcpros/bitcore-lib-ltc';
import * as BitcoreLibXec from '@bcpros/bitcore-lib-xec';
import * as BitcoreLibXpi from '@bcpros/bitcore-lib-xpi';
import Web3 from 'web3';
import { Constants } from './constants';
import Deriver from './derivation';
import Transactions from './transactions';
import Validation from './validation';
export {
  BitcoreLib,
  BitcoreLibCash,
  BitcoreLibDoge,
  BitcoreLibXpi,
  BitcoreLibXec,
  BitcoreLibLtc,
  Deriver,
  Transactions,
  Validation,
  Web3,
  Constants
};
