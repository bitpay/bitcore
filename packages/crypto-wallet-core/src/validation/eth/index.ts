import { ethers } from 'ethers';
import { IValidation } from '..';
const utils = require('web3-utils');

export class EthValidation implements IValidation {
  validateAddress(_network: string, address: string): boolean {
    return utils.isAddress(address);
  }

  validateUri(addressUri: string): boolean {
    if (!addressUri) {
      return false;
    }
    const address = this.extractAddress(addressUri);
    const ethereumPrefix = /ethereum/i.exec(addressUri);
    return !!ethereumPrefix && utils.isAddress(address);
  }

  validateRawTx(params: { raw: string; txp: any, fields: Array<string> }) {
    let { raw, txp, fields } = params;
    const parsedTx = ethers.utils.parseTransaction(raw);
    for (const field of fields) {
      if (parsedTx[field] != txp[field]) return false;
    }
    return true;
  }

  protected extractAddress(data) {
    const prefix = /^[a-z]+:/i;
    const params = /([\?\&](value|gas|gasPrice|gasLimit)=(\d+([\,\.]\d+)?))+/i;
    return data.replace(prefix, '').replace(params, '');
  }
}
