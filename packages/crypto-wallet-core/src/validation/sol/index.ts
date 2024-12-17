import * as Web3 from '@solana/web3.js'
import baseX from 'base-x';
import Bitcore from 'bitcore-lib';
import { IValidation } from '..';

const RIPPLE_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';

export class SolValidation implements IValidation {
  regex: RegExp;

  constructor() {
    this.regex = /solana/i;
  }
  validateAddress(_network: string, address: string): boolean {
    try {
      new Web3.PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  validateUri(addressUri: string): boolean {
    if (!addressUri) {
      return false;
    }
    const address = this.extractAddress(addressUri);
    const prefix = this.regex.exec(addressUri);
    return !!prefix && this.validateAddress('livenet', address);
  }

  private extractAddress(data) {
    const prefix = /^[a-z]+:/i;
    const params = /([\?\&](amount|fee)=(\d+([\,\.]\d+)?))+/i;
    return data.replace(prefix, '').replace(params, '');
  }
}
