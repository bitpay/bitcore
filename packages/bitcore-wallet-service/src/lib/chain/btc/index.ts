import { BitcoreLib } from 'crypto-wallet-core';
import _ from 'lodash';
import { IChain } from '..';
import { ClientError } from '../../errors/clienterror';
import { TxProposal } from '../../model';

const $ = require('preconditions').singleton();
const Common = require('../../common');
const Constants = Common.Constants;
const Utils = Common.Utils;
const Defaults = Common.Defaults;
const Errors = require('../../errors/errordefinitions');

export class BtcChain implements IChain {
  constructor(private bitcoreLib = BitcoreLib) { }

  getWalletBalance(server, wallet, opts, cb) {
    server._getUtxosForCurrentWallet(
      {
        coin: opts.coin,
        addresses: opts.addresses
      },
      (err, utxos) => {
        if (err) return cb(err);

        const balance = {
          ...server._totalizeUtxos(utxos),
          byAddress: []
        };

        // Compute balance by address
        const byAddress = {};
        _.each(_.keyBy(_.sortBy(utxos, 'address'), 'address'), (value, key) => {
          byAddress[key] = {
            address: key,
            path: value.path,
            amount: 0
          };
        });

        _.each(utxos, utxo => {
          byAddress[utxo.address].amount += utxo.satoshis;
        });

        balance.byAddress = _.values(byAddress);

        return cb(null, balance);
      }
    );
  }

  getWalletSendMaxInfo(server, wallet, opts, cb) {
    server._getUtxosForCurrentWallet({}, (err, utxos) => {
      if (err) return cb(err);

      const info = {
        size: 0,
        amount: 0,
        fee: 0,
        feePerKb: 0,
        inputs: [],
        utxosBelowFee: 0,
        amountBelowFee: 0,
        utxosAboveMaxSize: 0,
        amountAboveMaxSize: 0
      };

      let inputs = _.reject(utxos, 'locked');
      if (!!opts.excludeUnconfirmedUtxos) {
        inputs = _.filter(inputs, 'confirmations');
      }
      inputs = _.sortBy(inputs, input => {
        return -input.satoshis;
      });

      if (_.isEmpty(inputs)) return cb(null, info);

      server._getFeePerKb(wallet, opts, (err, feePerKb) => {
        if (err) return cb(err);

        info.feePerKb = feePerKb;

        const txp = TxProposal.create({
          walletId: server.walletId,
          coin: wallet.coin,
          network: wallet.network,
          walletM: wallet.m,
          walletN: wallet.n,
          feePerKb
        });

        const baseTxpSize = txp.getEstimatedSize();
        const sizePerInput = txp.getEstimatedSizeForSingleInput();
        const feePerInput = (sizePerInput * txp.feePerKb) / 1000;

        const partitionedByAmount = _.partition(inputs, input => {
          return input.satoshis > feePerInput;
        });

        info.utxosBelowFee = partitionedByAmount[1].length;
        info.amountBelowFee = _.sumBy(partitionedByAmount[1], 'satoshis');
        inputs = partitionedByAmount[0];

        _.each(inputs, (input, i) => {
          const sizeInKb = (baseTxpSize + (i + 1) * sizePerInput) / 1000;
          if (sizeInKb > Defaults.MAX_TX_SIZE_IN_KB[wallet.coin]) {
            info.utxosAboveMaxSize = inputs.length - i;
            info.amountAboveMaxSize = _.sumBy(_.slice(inputs, i), 'satoshis');
            return false;
          }
          txp.inputs.push(input);
        });

        if (_.isEmpty(txp.inputs)) return cb(null, info);

        const fee = txp.getEstimatedFee();
        const amount = _.sumBy(txp.inputs, 'satoshis') - fee;

        if (amount < Defaults.MIN_OUTPUT_AMOUNT) return cb(null, info);

        info.size = txp.getEstimatedSize();
        info.fee = fee;
        info.amount = amount;

        if (opts.returnInputs) {
          info.inputs = _.shuffle(txp.inputs);
        }

        return cb(null, info);
      });
    });
  }

  getDustAmountValue() {
    return this.bitcoreLib.Transaction.DUST_AMOUNT;
  }

  getTransactionCount() {
    return null;
  }

  getChangeAddress(server, wallet, opts) {
    return new Promise((resolve, reject) => {
      const getChangeAddress = (wallet, cb) => {
        if (wallet.singleAddress) {
          server.storage.fetchAddresses(server.walletId, (err, addresses) => {
            if (err) return cb(err);
            if (_.isEmpty(addresses))
              return cb(new ClientError('The wallet has no addresses'));
            return cb(null, _.head(addresses));
          });
        } else {
          if (opts.changeAddress) {
            const addrErr = this.validateAddress(
              wallet,
              opts.changeAddress,
              opts
            );
            if (addrErr) return cb(addrErr);

            server.storage.fetchAddressByWalletId(
              wallet.id,
              opts.changeAddress,
              (err, address) => {
                if (err || !address) return cb(Errors.INVALID_CHANGE_ADDRESS);
                return cb(null, address);
              }
            );
          } else {
            return cb(null, wallet.createAddress(true), true);
          }
        }
      };

      getChangeAddress(wallet, (err, address, isNew) => {
        if (err) return reject(err);
        return resolve(address);
      });
    });
  }

  checkDust(output) {
    const dustThreshold = Math.max(
      Defaults.MIN_OUTPUT_AMOUNT,
      this.bitcoreLib.Transaction.DUST_AMOUNT
    );

    if (output.amount < dustThreshold) {
      return Errors.DUST_AMOUNT;
    }
  }

  getFee(server, wallet, opts) {
    return new Promise(resolve => {
      server._getFeePerKb(wallet, opts, (err, feePerKb) => {
        return resolve({ feePerKb });
      });
    });
  }

  buildTx(txp) {
    const t = new this.bitcoreLib.Transaction();

    switch (txp.addressType) {
      case Constants.SCRIPT_TYPES.P2SH:
        _.each(txp.inputs, i => {
          $.checkState(i.publicKeys, 'Inputs should include public keys');
          t.from(i, i.publicKeys, txp.requiredSignatures);
        });
        break;
      case Constants.SCRIPT_TYPES.P2PKH:
        t.from(txp.inputs);
        break;
    }

    _.each(txp.outputs, o => {
      $.checkState(
        o.script || o.toAddress,
        'Output should have either toAddress or script specified'
      );
      if (o.script) {
        t.addOutput(
          new this.bitcoreLib.Transaction.Output({
            script: o.script,
            satoshis: o.amount
          })
        );
      } else {
        t.to(o.toAddress, o.amount);
      }
    });

    t.fee(txp.fee);

    if (txp.changeAddress) {
      t.change(txp.changeAddress.address);
    }

    // Shuffle outputs for improved privacy
    if (t.outputs.length > 1) {
      const outputOrder = _.reject(txp.outputOrder, (order: number) => {
        return order >= t.outputs.length;
      });
      $.checkState(t.outputs.length == outputOrder.length);
      t.sortOutputs(outputs => {
        return _.map(outputOrder, i => {
          return outputs[i];
        });
      });
    }

    // Validate actual inputs vs outputs independently of Bitcore
    const totalInputs = _.sumBy(t.inputs, 'output.satoshis');
    const totalOutputs = _.sumBy(t.outputs, 'satoshis');

    $.checkState(
      totalInputs > 0 && totalOutputs > 0 && totalInputs >= totalOutputs,
      'not-enought-inputs'
    );
    $.checkState(
      totalInputs - totalOutputs <= Defaults.MAX_TX_FEE[txp.coin],
      'fee-too-high'
    );

    return t;
  }

  convertFeePerKb(p, feePerKb) {
    return [p, Utils.strip(feePerKb * 1e8)];
  }

  checkTx(server, txp) {
    let bitcoreError;

    const serializationOpts = {
      disableIsFullySigned: true,
      disableSmallFees: true,
      disableLargeFees: true
    };
    if (_.isEmpty(txp.inputPaths)) return Errors.NO_INPUT_PATHS;

    try {
      const bitcoreTx = txp.getBitcoreTx();
      bitcoreError = bitcoreTx.getSerializationError(serializationOpts);
      if (!bitcoreError) {
        txp.fee = bitcoreTx.getFee();
      }
    } catch (ex) {
      server.logw('Error building Bitcore transaction', ex);
      return ex;
    }

    if (bitcoreError instanceof this.bitcoreLib.errors.Transaction.FeeError)
      return Errors.INSUFFICIENT_FUNDS_FOR_FEE;

    if (bitcoreError instanceof this.bitcoreLib.errors.Transaction.DustOutputs)
      return Errors.DUST_AMOUNT;
    return bitcoreError;
  }

  checkTxUTXOs(server, txp, opts, cb) {
    server.logd('Rechecking UTXOs availability for publishTx');

    const utxoKey = utxo => {
      return utxo.txid + '|' + utxo.vout;
    };

    server._getUtxosForCurrentWallet(
      {
        addresses: txp.inputs
      },
      (err, utxos) => {
        if (err) return cb(err);

        const txpInputs = _.map(txp.inputs, utxoKey);
        const utxosIndex = _.keyBy(utxos, utxoKey);
        const unavailable = _.some(txpInputs, i => {
          const utxo = utxosIndex[i];
          return !utxo || utxo.locked;
        });

        if (unavailable) return cb(Errors.UNAVAILABLE_UTXOS);
        return cb();
      }
    );
  }

  selectTxInputs(server, txp, wallet, opts, cb, next) {
    return server._selectTxInputs(txp, opts.utxosToExclude, next);
  }

  checkUtxos(opts) {
    if (_.isNumber(opts.fee) && _.isEmpty(opts.inputs)) return true;
  }

  checkValidTxAmount(output): boolean {
    if (
      !_.isNumber(output.amount) ||
      _.isNaN(output.amount) ||
      output.amount <= 0
    ) {
      return false;
    }
    return true;
  }

  setInputs(info) {
    return info.inputs;
  }

  isUTXOCoin() {
    return true;
  }
  isSingleAddress() {
    return false;
  }

  addressFromStorageTransform(network, address) { }

  addressToStorageTransform(network, address) { }

  addSignaturesToBitcoreTx(tx, inputs, inputPaths, signatures, xpub) {
    if (signatures.length != inputs.length)
      throw new Error('Number of signatures does not match number of inputs');

    let i = 0;
    const x = new this.bitcoreLib.HDPublicKey(xpub);

    _.each(signatures, signatureHex => {
      try {
        const signature = this.bitcoreLib.crypto.Signature.fromString(
          signatureHex
        );
        const pub = x.deriveChild(inputPaths[i]).publicKey;
        const s = {
          inputIndex: i,
          signature,
          sigtype:
            // tslint:disable-next-line:no-bitwise
            this.bitcoreLib.crypto.Signature.SIGHASH_ALL |
            this.bitcoreLib.crypto.Signature.SIGHASH_FORKID,
          publicKey: pub
        };
        tx.inputs[i].addSignature(tx, s);
        i++;
      } catch (e) { }
    });

    if (i != tx.inputs.length) throw new Error('Wrong signatures');
  }

  validateAddress(wallet, inaddr, opts) {
    const A = this.bitcoreLib.Address;
    let addr: {
      network?: string;
      toString?: (cashAddr: boolean) => string;
    } = {};
    try {
      addr = new A(inaddr);
    } catch (ex) {
      return Errors.INVALID_ADDRESS;
    }
    if (addr.network.toString() != wallet.network) {
      return Errors.INCORRECT_ADDRESS_NETWORK;
    }
    return;
  }
}
