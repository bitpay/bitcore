import { BitcoreLibCash } from 'crypto-wallet-core';
import _ from 'lodash';
import { IChain } from '..';
import { BtcChain } from '../btc';

const BCHAddressTranslator = require('../../bchaddresstranslator');
const Common = require('../../common');
const Defaults = Common.Defaults;
const Errors = require('../../errors/errordefinitions');

export class BchChain extends BtcChain implements IChain {
  getDustAmountValue() {
    return BitcoreLibCash.Transaction.DUST_AMOUNT;
  }

  checkErrorOutputs(output) {
    const dustThreshold = Math.max(
      Defaults.MIN_OUTPUT_AMOUNT,
      BitcoreLibCash.Transaction.DUST_AMOUNT
    );

    if (output.amount < dustThreshold) {
      return Errors.DUST_AMOUNT;
    }
  }

  checkTx(txp) {
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
      this.logw('Error building Bitcore transaction', ex);
      return ex;
    }

    if (bitcoreError instanceof BitcoreLibCash.errors.Transaction.FeeError)
      return Errors.INSUFFICIENT_FUNDS_FOR_FEE;

    if (
      bitcoreError instanceof BitcoreLibCash.errors.Transaction.DustOutputs
    )
      return Errors.DUST_AMOUNT;
    return bitcoreError;
  }

  storeAndNotifyTx(txp, opts, cb) {
    log.debug('Rechecking UTXOs availability for publishTx');

    const utxoKey = (utxo) => {
      return utxo.txid + '|' + utxo.vout;
    };

    this._getUtxosForCurrentWallet(
      {
        addresses: txp.inputs
      },
      (err, utxos) => {
        if (err) return cb(err);

        const txpInputs = _.map(txp.inputs, utxoKey);
        const utxosIndex = _.keyBy(utxos, utxoKey);
        const unavailable = _.some(txpInputs, (i) => {
          const utxo = utxosIndex[i];
          return !utxo || utxo.locked;
        });

        if (unavailable) return cb(Errors.UNAVAILABLE_UTXOS);

        txp.status = 'pending';
        this.storage.storeTx(this.walletId, txp, (err) => {
          if (err) return cb(err);

          this._notifyTxProposalAction('NewTxProposal', txp, () => {
            if (opts.noCashAddr) {
              if (txp.changeAddress) {
                txp.changeAddress.address = BCHAddressTranslator.translate(
                  txp.changeAddress.address,
                  'copay'
                );
              }
            }
            return cb(null, txp);
          });
        });
      }
    );
  }
}