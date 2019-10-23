import { BitcoreLibCash } from 'crypto-wallet-core';
import _ from 'lodash';
import { IChain } from '..';
import { BtcChain } from '../btc';

const BCHAddressTranslator = require('../../bchaddresstranslator');
const Common = require('../../common');
const Defaults = Common.Defaults;
const Errors = require('../../errors/errordefinitions');

export class BchChain extends BtcChain implements IChain {
  constructor() {
    super(BitcoreLibCash);
  }
}
