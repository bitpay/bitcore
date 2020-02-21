import _ from 'lodash';

const $ = require('preconditions').singleton();
const Constants = require('../common/constants');
const Utils = require('../common/utils');

export interface IAddressManager {
  version: number;
  derivationStrategy: string;
  receiveAddressIndex: number;
  changeAddressIndex: number;
  copayerIndex: number;
  skippedPaths: Array<{ path: string; isChange: boolean }>;
}

export class AddressManager {
  version: number;
  derivationStrategy: string;
  receiveAddressIndex: number = 0;
  changeAddressIndex: number = 0;
  copayerIndex: number;
  skippedPaths: Array<{ path: string; isChange: boolean }>;

  static create(opts) {
    opts = opts || {};

    const x = new AddressManager();

    x.version = 2;
    x.derivationStrategy = opts.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
    $.checkState(Utils.checkValueInCollection(x.derivationStrategy, Constants.DERIVATION_STRATEGIES));

    x.receiveAddressIndex = 0;
    x.changeAddressIndex = 0;
    x.copayerIndex = _.isNumber(opts.copayerIndex) ? opts.copayerIndex : Constants.BIP45_SHARED_INDEX;
    x.skippedPaths = [];

    return x;
  }

  static fromObj(obj) {
    const x = new AddressManager();

    x.version = obj.version;
    x.derivationStrategy = obj.derivationStrategy || Constants.DERIVATION_STRATEGIES.BIP45;
    x.receiveAddressIndex = obj.receiveAddressIndex || 0;
    x.changeAddressIndex = obj.changeAddressIndex || 0;
    x.copayerIndex = obj.copayerIndex;

    // this is not stored, only temporary.
    x.skippedPaths = [];

    return x;
  }

  static supportsCopayerBranches(derivationStrategy) {
    return derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45;
  }

  _incrementIndex(isChange) {
    if (isChange) {
      this.changeAddressIndex++;
    } else {
      this.receiveAddressIndex++;
    }
  }

  rewindIndex(isChange, step, n) {
    step = _.isUndefined(step) ? 1 : step;
    n = _.isUndefined(n) ? 1 : n;

    if (isChange) {
      this.changeAddressIndex = Math.max(0, this.changeAddressIndex - n * step);
    } else {
      this.receiveAddressIndex = Math.max(0, this.receiveAddressIndex - n * step);
    }

    // clear skipppedPath, since index is rewinded
    // n address were actually derived.
    this.skippedPaths = this.skippedPaths.splice(0, this.skippedPaths.length - step * n + n);
  }

  getCurrentIndex(isChange) {
    return isChange ? this.changeAddressIndex : this.receiveAddressIndex;
  }

  getBaseAddressPath(isChange) {
    return (
      'm/' +
      (this.derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45 ? this.copayerIndex + '/' : '') +
      (isChange ? 1 : 0) +
      '/' +
      0
    );
  }

  getCurrentAddressPath(isChange) {
    return (
      'm/' +
      (this.derivationStrategy == Constants.DERIVATION_STRATEGIES.BIP45 ? this.copayerIndex + '/' : '') +
      (isChange ? 1 : 0) +
      '/' +
      (isChange ? this.changeAddressIndex : this.receiveAddressIndex)
    );
  }

  getNewAddressPath(isChange, step = 1) {
    let ret;
    let i = 0;
    step = step || 1;

    while (i++ < step) {
      if (ret) {
        this.skippedPaths.push({ path: ret, isChange });
      }

      ret = this.getCurrentAddressPath(isChange);
      this._incrementIndex(isChange);
    }
    return ret;
  }

  getNextSkippedPath() {
    if (_.isEmpty(this.skippedPaths)) return null;

    const ret = this.skippedPaths.pop();
    return ret;
  }

  parseDerivationPath(path) {
    const pathIndex = /m\/([0-9]*)\/([0-9]*)/;
    const [_input, changeIndex, addressIndex] = path.match(pathIndex);
    const isChange = changeIndex > 0;
    return { _input, addressIndex, isChange };
  }
}
