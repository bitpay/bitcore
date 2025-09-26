import * as async from 'async';
import { BitcoreLibDoge } from 'crypto-wallet-core';
import _ from 'lodash';
import { IChain } from '../../../types/chain';
import { BtcChain } from '../../chain/btc';
import { Common } from '../../common';
import { ClientError } from '../../errors/clienterror';
import { Errors } from '../../errors/errordefinitions';
import logger from '../../logger';
import { TxProposal } from '../../model';

const { Utils, Defaults } = Common;

export class DogeChain extends BtcChain implements IChain {
  constructor(private bitcoreLibDoge = BitcoreLibDoge) {
    super(BitcoreLibDoge);
  }

  selectTxInputs(server, txp, wallet, opts, cb) {
    const MAX_TX_SIZE_IN_KB = Defaults.MAX_TX_SIZE_IN_KB_DOGE;

    // todo: check inputs are ours and have enough value
    if (txp.inputs && txp.inputs.length > 0) {
      if (!Utils.isNumber(txp.fee)) txp.fee = this.getEstimatedFee(txp, { conservativeEstimation: true });
      return cb(this.checkTx(txp));
    }

    const feeOpts = { conservativeEstimation: opts.payProUrl ? true : false };
    const txpAmount = txp.getTotalAmount();
    const baseTxpSize = this.getEstimatedSize(txp, feeOpts);
    const baseTxpFee = (baseTxpSize * txp.feePerKb) / 1000;
    const sizePerInput = this.getEstimatedSizeForSingleInput(txp, feeOpts);
    const feePerInput = (sizePerInput * txp.feePerKb) / 1000;

    logger.debug(`Amount ${Utils.formatAmountInBtc(txpAmount)} baseSize ${baseTxpSize} baseTxpFee ${baseTxpFee} sizePerInput ${sizePerInput}  feePerInput ${feePerInput}`);

    const sanitizeUtxos = utxos => {
      const excludeIndex = (opts.utxosToExclude || []).reduce(
        (res, val) => {
          res[val] = val;
          return res;
        },
        {}
      );

      return (utxos || []).filter(utxo => {
        if (utxo.locked) return false;
        if (utxo.satoshis <= feePerInput) return false;
        if (txp.excludeUnconfirmedUtxos && !utxo.confirmations) return false;
        if (excludeIndex[utxo.txid + ':' + utxo.vout]) return false;
        return true;
      });
    };

    const select = (utxos, coin, cb) => {
      const totalValueInUtxos = utxos.reduce((sum, utxo) => sum + utxo.satoshis, 0);
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
        logger.debug(`Value after fees in all utxos (${Utils.formatAmountInBtc(netValueInUtxos)}) is insufficient to cover for txp amount (${Utils.formatAmountInBtc(txpAmount)})`);

        return cb(
          new ClientError(
            Errors.codes.INSUFFICIENT_FUNDS_FOR_FEE,
            `${Errors.INSUFFICIENT_FUNDS_FOR_FEE.message}. RequiredFee: ${baseTxpFee} Coin: ${txp.coin} feePerKb: ${txp.feePerKb} Err2`,
            {
              coin: txp.coin,
              feePerKb: txp.feePerKb,
              requiredFee: baseTxpFee
            }
          )
        );
      }

      const bigInputThreshold = txpAmount * Defaults.UTXO_SELECTION_MAX_SINGLE_UTXO_FACTOR + (baseTxpFee + feePerInput);
      logger.debug('Big input threshold ' + Utils.formatAmountInBtc(bigInputThreshold));


      const partitions = [[], []];
      for (const utxo of utxos) {
        if (utxo.satoshis > bigInputThreshold) {
          partitions[0].push(utxo);
        } else {
          partitions[1].push(utxo);
        }
      }

      const bigInputs = Utils.sortAsc(partitions[0], 'satoshis')
      const smallInputs = Utils.sortDesc(partitions[1], 'satoshis');

      logger.debug('Considering ' + bigInputs.length + ' big inputs (' + Utils.formatUtxos(bigInputs) + ')');
      logger.debug('Considering ' + smallInputs.length + ' small inputs (' + Utils.formatUtxos(smallInputs) + ')');

      let total = 0;
      let netTotal = -baseTxpFee;
      let selected = [];
      let fee;
      let error;

      for (let i = 0; i < smallInputs.length; i++) {
        const input = smallInputs[i];
        logger.debug('Input #' + i + ': ' + Utils.formatUtxos(input));

        const netInputAmount = input.satoshis - feePerInput;

        logger.debug('The input contributes ' + Utils.formatAmountInBtc(netInputAmount));

        selected.push(input);

        total += input.satoshis;
        netTotal += netInputAmount;

        const txpSize = baseTxpSize + selected.length * sizePerInput;
        fee = Math.round(baseTxpFee + selected.length * feePerInput);
        fee = Math.max(fee, this.bitcoreLibDoge.Transaction.DUST_AMOUNT);

        logger.debug('Tx size: ' + Utils.formatSize(txpSize) + ', Tx fee: ' + Utils.formatAmountInBtc(fee));

        const feeVsAmountRatio = fee / txpAmount;
        const amountVsUtxoRatio = netInputAmount / txpAmount;

        // logger.debug('Fee/Tx amount: ' + Utils.formatRatio(feeVsAmountRatio) + ' (max: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MAX_FEE_VS_TX_AMOUNT_FACTOR) + ')');
        // logger.debug('Tx amount/Input amount:' + Utils.formatRatio(amountVsUtxoRatio) + ' (min: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR) + ')');

        if (txpSize / 1000 > MAX_TX_SIZE_IN_KB) {
          // logger.debug('Breaking because tx size (' + Utils.formatSize(txpSize) + ') is too big (max: ' + Utils.formatSize(this.MAX_TX_SIZE_IN_KB * 1000.) + ')');
          error = Errors.TX_MAX_SIZE_EXCEEDED;
          break;
        }

        if (bigInputs?.length > 0) {
          if (amountVsUtxoRatio < Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR) {
            // logger.debug('Breaking because utxo is too small compared to tx amount');
            break;
          }

          if (feeVsAmountRatio > Defaults.UTXO_SELECTION_MAX_FEE_VS_TX_AMOUNT_FACTOR) {
            const feeVsSingleInputFeeRatio = fee / (baseTxpFee + feePerInput);
            // logger.debug('Fee/Single-input fee: ' + Utils.formatRatio(feeVsSingleInputFeeRatio) + ' (max: ' + Utils.formatRatio(Defaults.UTXO_SELECTION_MAX_FEE_VS_SINGLE_UTXO_FEE_FACTOR) + ')' + ' loses wrt single-input tx: ' + Utils.formatAmountInBtc((selected.length - 1) * feePerInput));
            if (feeVsSingleInputFeeRatio > Defaults.UTXO_SELECTION_MAX_FEE_VS_SINGLE_UTXO_FEE_FACTOR) {
              // logger.debug('Breaking because fee is too significant compared to tx amount and it is too expensive compared to using single input');
              break;
            }
          }
        }

        logger.debug(`Cumuled total so far: ${Utils.formatAmountInBtc(total)}, Net total so far: ${Utils.formatAmountInBtc(netTotal)}`);

        if (netTotal >= txpAmount) {
          const changeAmount = Math.round(total - txpAmount - fee);
          logger.debug(`Tx change: ${Utils.formatAmountInBtc(changeAmount)}`);

          const dustThreshold = Math.max(Defaults.MIN_OUTPUT_AMOUNT, this.bitcoreLibDoge.Transaction.DUST_AMOUNT);
          if (changeAmount > 0 && changeAmount <= dustThreshold) {
            logger.debug(`Change below dust threshold (${Utils.formatAmountInBtc(dustThreshold)}). Incrementing fee to remove change.`);
            // Remove dust change by incrementing fee
            fee += changeAmount;
          }

          break;
        }
      }

      if (netTotal < txpAmount) {
        logger.debug(`Could not reach Txp total (${Utils.formatAmountInBtc(txpAmount)}), still missing: ${Utils.formatAmountInBtc(txpAmount - netTotal)}`);

        selected = [];
        if (bigInputs?.length > 0) {
          const input = bigInputs[0];
          logger.debug(`Using big input: ${Utils.formatUtxos(input)}`);
          total = input.satoshis;
          fee = Math.round(baseTxpFee + feePerInput);
          fee = Math.max(fee, this.bitcoreLibDoge.Transaction.DUST_AMOUNT);
          netTotal = total - fee;
          selected = [input];
        }
      }

      if (selected.length === 0) {
        // logger.debug('Could not find enough funds within this utxo subset');
        return cb(
          error ||
            new ClientError(
              Errors.codes.INSUFFICIENT_FUNDS_FOR_FEE,
              `${Errors.INSUFFICIENT_FUNDS_FOR_FEE.message}. RequiredFee: ${fee} Coin: ${txp.coin} feePerKb: ${txp.feePerKb} Err3`,
              {
                coin: txp.coin,
                feePerKb: txp.feePerKb,
                requiredFee: fee
              }
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
          return i < groups.length && !inputs?.length;
        },
        next => {
          const group = groups[i++];

          const candidateUtxos = utxos.filter(utxo => utxo.confirmations >= group);

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

            logger.debug('Selected inputs from this group: ' + Utils.formatUtxos(inputs));
            logger.debug('Fee for this selection: ' + Utils.formatAmountInBtc(fee));

            return next();
          });
        },
        err => {
          if (err) return cb(err);
          if (selectionError || !inputs.length) return cb(selectionError || new Error('Could not select tx inputs'));

          txp.setInputs(_.shuffle(inputs));
          txp.fee = fee;

          err = this.checkTx(txp);
          if (!err) {
            const sumInputs = txp.inputs.reduce((sum, input) => sum += input.satoshis, 0);
            const sumOutputs = txp.outputs.reduce((sum, output) => sum += output.amount, 0);
            const change = sumInputs - sumOutputs - txp.fee;
            logger.debug(`Successfully built transaction. Total fees: ${Utils.formatAmountInBtc(txp.fee)}, total change: ${Utils.formatAmountInBtc(change)}`);
          } else {
            logger.warn('Error building transaction: %o', err);
          }

          return cb(err);
        }
      );
    });
  }

  getWalletSendMaxInfo(server, wallet, opts, cb) {
    server.getUtxosForCurrentWallet({}, (err, utxos) => {
      if (err) return cb(err);

      const MAX_TX_SIZE_IN_KB = Defaults.MAX_TX_SIZE_IN_KB_DOGE;

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

      let inputs = utxos.filter(utxo => !utxo.locked);
      if (!!opts.excludeUnconfirmedUtxos) {
        inputs = inputs.filter(input => input.confirmations);
      }
      inputs = Utils.sortDesc(inputs, 'satoshis');

      if (!inputs.length) return cb(null, info);

      server._getFeePerKb(wallet, opts, (err, feePerKb) => {
        if (err) return cb(err);

        info.feePerKb = feePerKb;

        const txp = TxProposal.create({
          walletId: server.walletId,
          coin: wallet.coin,
          addressType: wallet.addressType,
          network: wallet.network,
          walletM: wallet.m,
          walletN: wallet.n,
          feePerKb
        });

        const baseTxpSize = this.getEstimatedSize(txp, { conservativeEstimation: true });
        const sizePerInput = this.getEstimatedSizeForSingleInput(txp, { conservativeEstimation: true });
        const feePerInput = (sizePerInput * txp.feePerKb) / 1000;

        const partitionedByAmount = [[], []];
        for (const input of inputs) {
          if (input.satoshis > feePerInput) {
            partitionedByAmount[0].push(input);
          } else {
            partitionedByAmount[1].push(input);
          }
        }

        info.utxosBelowFee = partitionedByAmount[1].length;
        info.amountBelowFee = partitionedByAmount[1].reduce((sum, x) => sum += x.satoshis, 0);
        inputs = partitionedByAmount[0];

        for (let i = 0; i < inputs.length; i++) {
          const input = inputs[i];
          const sizeInKb = (baseTxpSize + (i + 1) * sizePerInput) / 1000;
          if (sizeInKb > MAX_TX_SIZE_IN_KB) {
            info.utxosAboveMaxSize = inputs.length - i;
            info.amountAboveMaxSize = inputs.slice(i).reduce((sum, x) => sum += x.satoshis, 0);
            break;
          }
          txp.inputs.push(input);
        }

        if (!txp.inputs?.length) return cb(null, info);

        const fee = this.getEstimatedFee(txp, { conservativeEstimation: true });
        const amount = txp.inputs.reduce((sum, x) => sum += x.satoshis, 0) - fee;
        info.size = this.getEstimatedSize(txp, { conservativeEstimation: true });
        info.fee = fee;
        info.amount = amount;
        if (amount < Defaults.MIN_OUTPUT_AMOUNT) return cb(null, info);

        if (opts.returnInputs) {
          info.inputs = _.shuffle(inputs);
        }

        return cb(null, info);
      });
    });
  }
}
