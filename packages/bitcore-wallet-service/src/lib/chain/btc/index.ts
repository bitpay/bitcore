import * as async from 'async';
import { BitcoreLib } from 'crypto-wallet-core';
import _ from 'lodash';
import { IChain, INotificationData } from '..';
import { ClientError } from '../../errors/clienterror';
import logger from '../../logger';
import { TxProposal } from '../../model';

const $ = require('preconditions').singleton();
const Common = require('../../common');
const Constants = Common.Constants;
const Utils = Common.Utils;
const Defaults = Common.Defaults;
const Errors = require('../../errors/errordefinitions');

export class BtcChain implements IChain {
  protected feeSafetyMargin: number;

  constructor(private bitcoreLib = BitcoreLib) {
    this.feeSafetyMargin = 0.02;
  }

  getWalletBalance(server, wallet, opts, cb) {
    server.getUtxosForCurrentWallet(
      {
        coin: opts.coin,
        addresses: opts.addresses
      },
      (err, utxos) => {
        if (err) return cb(err);

        const balance = {
          ...this.totalizeUtxos(utxos),
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
    server.getUtxosForCurrentWallet({}, (err, utxos) => {
      if (err) return cb(err);

      const MAX_TX_SIZE_IN_KB = Defaults.MAX_TX_SIZE_IN_KB_BTC;

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

        const baseTxpSize = this.getEstimatedSize(txp);
        const sizePerInput = this.getEstimatedSizeForSingleInput(txp);
        const feePerInput = (sizePerInput * txp.feePerKb) / 1000;

        const partitionedByAmount = _.partition(inputs, input => {
          return input.satoshis > feePerInput;
        });

        info.utxosBelowFee = partitionedByAmount[1].length;
        info.amountBelowFee = _.sumBy(partitionedByAmount[1], 'satoshis');
        inputs = partitionedByAmount[0];

        _.each(inputs, (input, i) => {
          const sizeInKb = (baseTxpSize + (i + 1) * sizePerInput) / 1000;
          if (sizeInKb > MAX_TX_SIZE_IN_KB) {
            info.utxosAboveMaxSize = inputs.length - i;
            info.amountAboveMaxSize = _.sumBy(_.slice(inputs, i), 'satoshis');
            return false;
          }
          txp.inputs.push(input);
        });

        if (_.isEmpty(txp.inputs)) return cb(null, info);

        const fee = this.getEstimatedFee(txp);
        const amount = _.sumBy(txp.inputs, 'satoshis') - fee;

        if (amount < Defaults.MIN_OUTPUT_AMOUNT) return cb(null, info);

        info.size = this.getEstimatedSize(txp);
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
            if (_.isEmpty(addresses)) return cb(new ClientError('The wallet has no addresses'));
            return cb(null, _.head(addresses));
          });
        } else {
          if (opts.changeAddress) {
            try {
              this.validateAddress(wallet, opts.changeAddress, opts);
            } catch (addrErr) {
              return cb(addrErr);
            }

            server.storage.fetchAddressByWalletId(wallet.id, opts.changeAddress, (err, address) => {
              if (err || !address) return cb(Errors.INVALID_CHANGE_ADDRESS);
              return cb(null, address);
            });
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
    const dustThreshold = Math.max(Defaults.MIN_OUTPUT_AMOUNT, this.bitcoreLib.Transaction.DUST_AMOUNT);

    if (output.amount < dustThreshold) {
      return Errors.DUST_AMOUNT;
    }
  }

  // https://bitcoin.stackexchange.com/questions/88226/how-to-calculate-the-size-of-multisig-transaction
  getEstimatedSizeForSingleInput(txp) {
    const SIGNATURE_SIZE = 72 + 1; // 73 is for non standanrd, not our wallet. +1 OP_DATA
    const PUBKEY_SIZE = 33 + 1; // +1 OP_DATA

    switch (txp.addressType) {
      case Constants.SCRIPT_TYPES.P2PKH:
        return 147;

      case Constants.SCRIPT_TYPES.P2WPKH:
        return 69; // vsize

      case Constants.SCRIPT_TYPES.P2WSH:
        return 32 + 4 + 1 + (txp.requiredSignatures * 74 + txp.walletN * 34) / 4 + 4; // vsize

      case Constants.SCRIPT_TYPES.P2SH:
        return 46 + txp.requiredSignatures * SIGNATURE_SIZE + txp.walletN * PUBKEY_SIZE;

      default:
        logger.warn('Unknown address type at getEstimatedSizeForSingleInput:', txp.addressType);
        return 46 + txp.requiredSignatures * SIGNATURE_SIZE + txp.walletN * PUBKEY_SIZE;
    }
  }

  // Data from:
  // https://bitcoin.stackexchange.com/questions/88226/how-to-calculate-the-size-of-multisig-transaction
  getEstimatedSizeForSingleOutput(address?: string) {
    let addressType = '';

    if (address) {
      const a = this.bitcoreLib.Address(address);
      addressType = a.type;
    }

    let scriptSize;
    switch (addressType) {
      case 'pubkeyhash':
        scriptSize = 25;
        break;
      case 'scripthash':
        scriptSize = 23;
        break;
      case 'witnesspubkeyhash':
        scriptSize = 22;
        break;
      case 'witnessscripthash':
        scriptSize = 34;
        break;
      default:
        scriptSize = 34;
        logger.warn('Unknown address type at getEstimatedSizeForSingleOutput:', addressType);
        break;
    }
    return scriptSize + 8 + 1; // value + script length
  }

  getEstimatedSize(txp) {
    const overhead = 4 + 4 + 1 + 1; // version, locktime, ninputs, noutputs

    // This assumed ALL inputs of the wallet are the same time
    const inputSize = this.getEstimatedSizeForSingleInput(txp);
    const nbInputs = txp.inputs.length;

    let outputsSize = 0;
    let outputs = _.isArray(txp.outputs) ? txp.outputs : [txp.toAddress];
    let addresses = outputs.map(x => x.toAddress);
    if (txp.changeAddress) {
      addresses.push(txp.changeAddress.address);
    }
    _.each(addresses, x => {
      outputsSize += this.getEstimatedSizeForSingleOutput(x);
    });

    // If there is no output yet defined, (eg: get sendmax info), add a single, default, output);
    if (!outputsSize) {
      outputsSize = this.getEstimatedSizeForSingleOutput();
    }

    const size = overhead + inputSize * nbInputs + outputsSize;
    return parseInt((size * (1 + this.feeSafetyMargin)).toFixed(0));
  }

  getEstimatedFee(txp) {
    $.checkState(_.isNumber(txp.feePerKb));
    let fee;

    // if TX is ready? no estimation is needed.
    if (txp.inputs.length && !txp.changeAddress && txp.outputs.length) {
      const totalInputs = _.sumBy(txp.inputs, 'satoshis');
      const totalOutputs = _.sumBy(txp.outputs, 'amount');
      if (totalInputs && totalOutputs) {
        fee = totalInputs - totalOutputs;
      }
    }

    if (!fee) {
      fee = (txp.feePerKb * this.getEstimatedSize(txp)) / 1000;
    }
    return parseInt(fee.toFixed(0));
  }

  getFee(server, wallet, opts) {
    return new Promise(resolve => {
      server._getFeePerKb(wallet, opts, (err, feePerKb) => {
        return resolve({ feePerKb });
      });
    });
  }

  getBitcoreTx(txp, opts = { signed: true }) {
    const t = new this.bitcoreLib.Transaction();

    // BTC tx version
    if (txp.version <= 3) {
      t.setVersion(1);
    } else {
      t.setVersion(2);

      // set nLockTime (only txp.version>=4)
      if (txp.lockUntilBlockHeight) t.lockUntilBlockHeight(txp.lockUntilBlockHeight);
    }

    /*
     * txp.inputs clean txp.input
     * removes possible nSequence number (BIP68)
     */
    let inputs = txp.inputs.map(x => {
      return {
        address: x.address,
        txid: x.txid,
        vout: x.vout,
        outputIndex: x.outputIndex,
        scriptPubKey: x.scriptPubKey,
        satoshis: x.satoshis,
        publicKeys: x.publicKeys
      };
    });

    switch (txp.addressType) {
      case Constants.SCRIPT_TYPES.P2WSH:
      case Constants.SCRIPT_TYPES.P2SH:
        _.each(inputs, i => {
          $.checkState(i.publicKeys, 'Inputs should include public keys');
          t.from(i, i.publicKeys, txp.requiredSignatures);
        });
        break;
      case Constants.SCRIPT_TYPES.P2WPKH:
      case Constants.SCRIPT_TYPES.P2PKH:
        t.from(inputs);
        break;
    }

    _.each(txp.outputs, o => {
      $.checkState(o.script || o.toAddress, 'Output should have either toAddress or script specified');
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

    $.checkState(totalInputs > 0 && totalOutputs > 0 && totalInputs >= totalOutputs, 'not-enough-inputs');
    $.checkState(totalInputs - totalOutputs <= Defaults.MAX_TX_FEE[txp.coin], 'fee-too-high');

    if (opts.signed) {
      const sigs = txp.getCurrentSignatures();
      _.each(sigs, x => {
        this.addSignaturesToBitcoreTx(t, txp.inputs, txp.inputPaths, x.signatures, x.xpub, txp.signingMethod);
      });
    }
    return t;
  }

  convertFeePerKb(p, feePerKb) {
    return [p, Utils.strip(feePerKb * 1e8)];
  }

  checkTx(txp) {
    let bitcoreError;
    const MAX_TX_SIZE_IN_KB = Defaults.MAX_TX_SIZE_IN_KB_BTC;

    if (this.getEstimatedSize(txp) / 1000 > MAX_TX_SIZE_IN_KB) return Errors.TX_MAX_SIZE_EXCEEDED;

    const serializationOpts = {
      disableIsFullySigned: true,
      disableSmallFees: true,
      disableLargeFees: true
    };
    if (_.isEmpty(txp.inputPaths)) return Errors.NO_INPUT_PATHS;

    try {
      const bitcoreTx = this.getBitcoreTx(txp);
      bitcoreError = bitcoreTx.getSerializationError(serializationOpts);
      if (!bitcoreError) {
        txp.fee = bitcoreTx.getFee();
      }
    } catch (ex) {
      logger.warn('Error building Bitcore transaction', ex);
      return ex;
    }

    if (bitcoreError instanceof this.bitcoreLib.errors.Transaction.FeeError)
      return new ClientError(
        Errors.codes.INSUFFICIENT_FUNDS_FOR_FEE,
        Errors.INSUFFICIENT_FUNDS_FOR_FEE.message + ' + coin: ' + txp.coin + ' feePerKb: ' + txp.feePerKb
      );
    if (bitcoreError instanceof this.bitcoreLib.errors.Transaction.DustOutputs) return Errors.DUST_AMOUNT;
    return bitcoreError;
  }

  checkTxUTXOs(server, txp, opts, cb) {
    logger.debug('Rechecking UTXOs availability for publishTx');

    const utxoKey = utxo => {
      return utxo.txid + '|' + utxo.vout;
    };

    server.getUtxosForCurrentWallet(
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

  totalizeUtxos(utxos) {
    const balance = {
      totalAmount: _.sumBy(utxos, 'satoshis'),
      lockedAmount: _.sumBy(_.filter(utxos, 'locked'), 'satoshis'),
      totalConfirmedAmount: _.sumBy(_.filter(utxos, 'confirmations'), 'satoshis'),
      lockedConfirmedAmount: _.sumBy(_.filter(_.filter(utxos, 'locked'), 'confirmations'), 'satoshis'),
      availableAmount: undefined,
      availableConfirmedAmount: undefined
    };
    balance.availableAmount = balance.totalAmount - balance.lockedAmount;
    balance.availableConfirmedAmount = balance.totalConfirmedAmount - balance.lockedConfirmedAmount;

    return balance;
  }

  selectTxInputs(server, txp, wallet, opts, cb) {
    const MAX_TX_SIZE_IN_KB = Defaults.MAX_TX_SIZE_IN_KB_BTC;

    // todo: check inputs are ours and have enough value
    if (txp.inputs && !_.isEmpty(txp.inputs)) {
      if (!_.isNumber(txp.fee)) txp.fee = this.getEstimatedFee(txp);
      return cb(this.checkTx(txp));
    }

    const txpAmount = txp.getTotalAmount();
    const baseTxpSize = this.getEstimatedSize(txp);
    const baseTxpFee = (baseTxpSize * txp.feePerKb) / 1000;
    const sizePerInput = this.getEstimatedSizeForSingleInput(txp);
    const feePerInput = (sizePerInput * txp.feePerKb) / 1000;

    const sanitizeUtxos = utxos => {
      const excludeIndex = _.reduce(
        opts.utxosToExclude,
        (res, val) => {
          res[val] = val;
          return res;
        },
        {}
      );

      return _.filter(utxos, utxo => {
        if (utxo.locked) return false;
        if (utxo.satoshis <= feePerInput) return false;
        if (txp.excludeUnconfirmedUtxos && !utxo.confirmations) return false;
        if (excludeIndex[utxo.txid + ':' + utxo.vout]) return false;
        return true;
      });
    };

    const select = (utxos, coin, cb) => {
      const totalValueInUtxos = _.sumBy(utxos, 'satoshis');
      const netValueInUtxos = totalValueInUtxos - (baseTxpFee - utxos.length * feePerInput);

      if (totalValueInUtxos < txpAmount) {
        logger.debug(
          'Total value in all utxos (' +
            Utils.formatAmountInBtc(totalValueInUtxos) +
            ') is insufficient to cover for txp amount (' +
            Utils.formatAmountInBtc(txpAmount) +
            ')'
        );
        return cb(Errors.INSUFFICIENT_FUNDS);
      }
      if (netValueInUtxos < txpAmount) {
        logger.debug(
          'Value after fees in all utxos (' +
            Utils.formatAmountInBtc(netValueInUtxos) +
            ') is insufficient to cover for txp amount (' +
            Utils.formatAmountInBtc(txpAmount) +
            ')'
        );

        return cb(
          new ClientError(
            Errors.codes.INSUFFICIENT_FUNDS_FOR_FEE,
            Errors.INSUFFICIENT_FUNDS_FOR_FEE.message + ' + coin: ' + txp.coin + ' feePerKb: ' + txp.feePerKb
          )
        );
      }

      const bigInputThreshold = txpAmount * Defaults.UTXO_SELECTION_MAX_SINGLE_UTXO_FACTOR + (baseTxpFee + feePerInput);
      logger.debug('Big input threshold ' + Utils.formatAmountInBtc(bigInputThreshold));

      const partitions = _.partition(utxos, utxo => {
        return utxo.satoshis > bigInputThreshold;
      });

      const bigInputs = _.sortBy(partitions[0], 'satoshis');
      const smallInputs = _.sortBy(partitions[1], utxo => {
        return -utxo.satoshis;
      });

      // logger.debug('Considering ' + bigInputs.length + ' big inputs (' + Utils.formatUtxos(bigInputs) + ')');
      // logger.debug('Considering ' + smallInputs.length + ' small inputs (' + Utils.formatUtxos(smallInputs) + ')');

      let total = 0;
      let netTotal = -baseTxpFee;
      let selected = [];
      let fee;
      let error;

      _.each(smallInputs, (input, i) => {
        // logger.debug('Input #' + i + ': ' + Utils.formatUtxos(input));

        const netInputAmount = input.satoshis - feePerInput;

        // logger.debug('The input contributes ' + Utils.formatAmountInBtc(netInputAmount));

        selected.push(input);

        total += input.satoshis;
        netTotal += netInputAmount;

        const txpSize = baseTxpSize + selected.length * sizePerInput;
        fee = Math.round(baseTxpFee + selected.length * feePerInput);

        // logger.debug('Tx size: ' + Utils.formatSize(txpSize) + ', Tx fee: ' + Utils.formatAmountInBtc(fee));

        const feeVsAmountRatio = fee / txpAmount;
        const amountVsUtxoRatio = netInputAmount / txpAmount;

        // logger.debug('Fee/Tx amount: ' + Utils.formatRatio(feeVsAmountRatio) + ' (max: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MAX_FEE_VS_TX_AMOUNT_FACTOR) + ')');
        // logger.debug('Tx amount/Input amount:' + Utils.formatRatio(amountVsUtxoRatio) + ' (min: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR) + ')');

        if (txpSize / 1000 > MAX_TX_SIZE_IN_KB) {
          // logger.debug('Breaking because tx size (' + Utils.formatSize(txpSize) + ') is too big (max: ' + Utils.formatSize(this.MAX_TX_SIZE_IN_KB * 1000.) + ')');
          error = Errors.TX_MAX_SIZE_EXCEEDED;
          return false;
        }

        if (!_.isEmpty(bigInputs)) {
          if (amountVsUtxoRatio < Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR) {
            // logger.debug('Breaking because utxo is too small compared to tx amount');
            return false;
          }

          if (feeVsAmountRatio > Defaults.UTXO_SELECTION_MAX_FEE_VS_TX_AMOUNT_FACTOR) {
            const feeVsSingleInputFeeRatio = fee / (baseTxpFee + feePerInput);
            // logger.debug('Fee/Single-input fee: ' + Utils.formatRatio(feeVsSingleInputFeeRatio) + ' (max: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MAX_FEE_VS_SINGLE_UTXO_FEE_FACTOR) + ')' + ' loses wrt single-input tx: ' + Utils.formatAmountInBtc((selected.length - 1) * feePerInput));
            if (feeVsSingleInputFeeRatio > Defaults.UTXO_SELECTION_MAX_FEE_VS_SINGLE_UTXO_FEE_FACTOR) {
              // logger.debug('Breaking because fee is too significant compared to tx amount and it is too expensive compared to using single input');
              return false;
            }
          }
        }

        // logger.debug('Cumuled total so far: ' + Utils.formatAmountInBtc(total) + ', Net total so far: ' + Utils.formatAmountInBtc(netTotal));

        if (netTotal >= txpAmount) {
          const changeAmount = Math.round(total - txpAmount - fee);
          // logger.debug('Tx change: ', Utils.formatAmountInBtc(changeAmount));

          const dustThreshold = Math.max(Defaults.MIN_OUTPUT_AMOUNT, this.bitcoreLib.Transaction.DUST_AMOUNT);
          if (changeAmount > 0 && changeAmount <= dustThreshold) {
            // logger.debug('Change below dust threshold (' + Utils.formatAmountInBtc(dustThreshold) + '). Incrementing fee to remove change.');
            // Remove dust change by incrementing fee
            fee += changeAmount;
          }

          return false;
        }
      });

      if (netTotal < txpAmount) {
        // logger.debug('Could not reach Txp total (' + Utils.formatAmountInBtc(txpAmount) + '), still missing: ' + Utils.formatAmountInBtc(txpAmount - netTotal));

        selected = [];
        if (!_.isEmpty(bigInputs)) {
          const input = _.head(bigInputs);
          // logger.debug('Using big input: ', Utils.formatUtxos(input));
          total = input.satoshis;
          fee = Math.round(baseTxpFee + feePerInput);
          netTotal = total - fee;
          selected = [input];
        }
      }

      if (_.isEmpty(selected)) {
        // log.debug('Could not find enough funds within this utxo subset');
        return cb(
          error ||
            new ClientError(
              Errors.codes.INSUFFICIENT_FUNDS_FOR_FEE,
              Errors.INSUFFICIENT_FUNDS_FOR_FEE.message + ' + coin: ' + txp.coin + ' feePerKb: ' + txp.feePerKb
            )
        );
      }

      return cb(null, selected, fee);
    };

    // logger.debug('Selecting inputs for a ' + Utils.formatAmountInBtc(txp.getTotalAmount()) + ' txp');

    server.getUtxosForCurrentWallet({}, (err, utxos) => {
      if (err) return cb(err);

      let totalAmount;
      let availableAmount;

      const balance = this.totalizeUtxos(utxos);
      if (txp.excludeUnconfirmedUtxos) {
        totalAmount = balance.totalConfirmedAmount;
        availableAmount = balance.availableConfirmedAmount;
      } else {
        totalAmount = balance.totalAmount;
        availableAmount = balance.availableAmount;
      }

      if (totalAmount < txp.getTotalAmount()) return cb(Errors.INSUFFICIENT_FUNDS);
      if (availableAmount < txp.getTotalAmount()) return cb(Errors.LOCKED_FUNDS);

      utxos = sanitizeUtxos(utxos);

      // logger.debug('Considering ' + utxos.length + ' utxos (' + Utils.formatUtxos(utxos) + ')');

      const groups = [6, 1];
      if (!txp.excludeUnconfirmedUtxos) groups.push(0);

      let inputs = [];
      let fee;
      let selectionError;
      let i = 0;
      let lastGroupLength;
      async.whilst(
        () => {
          return i < groups.length && _.isEmpty(inputs);
        },
        next => {
          const group = groups[i++];

          const candidateUtxos = _.filter(utxos, utxo => {
            return utxo.confirmations >= group;
          });

          // logger.debug('Group >= ' + group);

          // If this group does not have any new elements, skip it
          if (lastGroupLength === candidateUtxos.length) {
            // logger.debug('This group is identical to the one already explored');
            return next();
          }

          // logger.debug('Candidate utxos: ' + Utils.formatUtxos(candidateUtxos));

          lastGroupLength = candidateUtxos.length;

          select(candidateUtxos, txp.coin, (err, selectedInputs, selectedFee) => {
            if (err) {
              // logger.debug('No inputs selected on this group: ', err);
              selectionError = err;
              return next();
            }

            selectionError = null;
            inputs = selectedInputs;
            fee = selectedFee;

            // logger.debug('Selected inputs from this group: ' + Utils.formatUtxos(inputs));
            // logger.debug('Fee for this selection: ' + Utils.formatAmountInBtc(fee));

            return next();
          });
        },
        err => {
          if (err) return cb(err);
          if (selectionError || _.isEmpty(inputs)) return cb(selectionError || new Error('Could not select tx inputs'));

          txp.setInputs(_.shuffle(inputs));
          txp.fee = fee;

          err = this.checkTx(txp);
          if (!err) {
            const change = _.sumBy(txp.inputs, 'satoshis') - _.sumBy(txp.outputs, 'amount') - txp.fee;
            logger.debug(
              'Successfully built transaction. Total fees: ' +
                Utils.formatAmountInBtc(txp.fee) +
                ', total change: ' +
                Utils.formatAmountInBtc(change)
            );
          } else {
            logger.debug('Error building transaction', err);
          }

          return cb(err);
        }
      );
    });
  }

  checkUtxos(opts) {
    if (_.isNumber(opts.fee) && _.isEmpty(opts.inputs)) return true;
  }

  checkValidTxAmount(output): boolean {
    if (!_.isNumber(output.amount) || _.isNaN(output.amount) || output.amount <= 0) {
      return false;
    }
    return true;
  }

  supportsMultisig() {
    return true;
  }

  notifyConfirmations(network: string) {
    if (network != 'livenet') return false;

    return true;
  }

  isUTXOCoin() {
    return true;
  }
  isSingleAddress() {
    return false;
  }

  addressFromStorageTransform(network, address) {}

  addressToStorageTransform(network, address) {}

  addSignaturesToBitcoreTx(tx, inputs, inputPaths, signatures, xpub, signingMethod) {
    signingMethod = signingMethod || 'ecdsa';
    if (signatures.length != inputs.length) throw new Error('Number of signatures does not match number of inputs');

    let i = 0;
    const x = new this.bitcoreLib.HDPublicKey(xpub);

    _.each(signatures, signatureHex => {
      try {
        const signature = this.bitcoreLib.crypto.Signature.fromString(signatureHex);
        const pub = x.deriveChild(inputPaths[i]).publicKey;
        const s = {
          inputIndex: i,
          signature,
          sigtype: this.bitcoreLib.crypto.Signature.SIGHASH_ALL | this.bitcoreLib.crypto.Signature.SIGHASH_FORKID,
          publicKey: pub
        };
        tx.inputs[i].addSignature(tx, s, signingMethod);
        i++;
      } catch (e) {}
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
      throw Errors.INVALID_ADDRESS;
    }
    if (addr.network.toString() != wallet.network) {
      throw Errors.INCORRECT_ADDRESS_NETWORK;
    }
    return;
  }

  // Push notification handling
  onCoin(coin) {
    // script output, or similar.
    if (!coin || !coin.address) return;

    return {
      out: {
        address: coin.address,
        amount: coin.value
      },
      txid: coin.mintTxid
    };
  }

  // Push notification handling
  onTx(tx) {
    return null;
  }
}
