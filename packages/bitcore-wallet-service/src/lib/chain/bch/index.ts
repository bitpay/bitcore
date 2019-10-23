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

  storeAndNotifyTx(server, txp, opts, cb) {
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

        txp.status = 'pending';
        server.storage.storeTx(
          server.walletId,
          txp,
          err => {
            if (err) return cb(err);

            server._notifyTxProposalAction(
              'NewTxProposal',
              txp,
              () => {
                if (opts.noCashAddr) {
                  if (txp.changeAddress) {
                    txp.changeAddress.address = BCHAddressTranslator.translate(
                      txp.changeAddress.address,
                      'copay'
                    );
                  }
                }
                return cb(null, txp);
              }
            );
          }
        );
      }
    );
  }
}
