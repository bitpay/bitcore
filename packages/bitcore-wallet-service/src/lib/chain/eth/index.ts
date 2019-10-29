import { Transactions } from 'crypto-wallet-core';
import _ from 'lodash';
import { IAddress } from 'src/lib/model/address';
import { IChain } from '..';

const Common = require('../../common');
const Constants = Common.Constants;
const Defaults = Common.Defaults;
const Errors = require('../../errors/errordefinitions');

export class EthChain implements IChain {

  getWalletBalance(server, wallet, opts, cb) {
    const bc = server._getBlockchainExplorer(
      wallet.coin,
      wallet.network
    );

    if (opts.tokenAddress) {
      wallet.tokenAddress = opts.tokenAddress;
    }

    bc.getBalance(wallet, (err, balance) => {
      if (err) {
        return cb(err);
      }
      server.getPendingTxs({}, (err, txps) => {
        if (err) return cb(err);
        const lockedSum = _.sumBy(txps, 'amount');
        const convertedBalance = server._convertBitcoreBalance(
          balance,
          lockedSum
        );
        server.storage.fetchAddresses(
          server.walletId,
          (err, addresses: IAddress[]) => {
            if (err) return cb(err);
            if (addresses.length > 0) {
              const byAddress = [
                {
                  address: addresses[0].address,
                  path: Constants.PATHS.SINGLE_ADDRESS,
                  amount: convertedBalance.totalAmount
                }
              ];
              convertedBalance.byAddress = byAddress;
            }
            return cb(null, convertedBalance);
          }
        );
      });
    });
  }

  getWalletSendMaxInfo(server, wallet, opts, cb) {
    server.getBalance({}, async(err, balance) => {
      if (err) return cb(err);
      const { totalAmount, availableAmount } = balance;

      try {
        const gasLimit = await server.estimateGas(
          {
            coin: wallet.coin,
            network: wallet.network,
            from: opts.from,
            to: '0x0', // a dummy address
            value: totalAmount, // it will be lest that this, at the end
            data: null,
            gasPrice: opts.feePerKb
          });
        let fee = opts.feePerKb * (gasLimit || Defaults.DEFAULT_GAS_LIMIT);
        return cb(null, {
              utxosBelowFee: 0,
              amountBelowFee: 0,
              amount: availableAmount - fee,
              feePerKb: opts.feePerKb,
              fee
            });
        } catch (err) {
          return cb(err, null);
        }
    });
  }

  getDustAmountValue() {
    return 0;
  }

  getTransactionCount(server, wallet, from) {
    return new Promise((resolve, reject) => {
      server._getTransactionCount(wallet, from, (err, nonce) => {
        if (err) return reject(err);
        return resolve(nonce);
      });
    });
  }

  getChangeAddress() {}

  checkDust(output, opts) {}

  getFee(server, wallet, opts) {
    return new Promise(resolve => {
      server._getFeePerKb(wallet, opts, async(err, inFeePerKb) => {
        let feePerKb = inFeePerKb;
        let gasPrice = inFeePerKb;
        const { from } = opts;
        const { coin, network } = wallet;
        let inGasLimit;
        for (let output of opts.outputs) {
          try {
            inGasLimit = await server.estimateGas({
              coin,
              network,
              from,
              to: output.toAddress,
              value: output.amount,
              data: output.data,
              gasPrice
            });
            output.gasLimit = inGasLimit || Defaults.DEFAULT_GAS_LIMIT;
          } catch (err) {
            output.gasLimit = Defaults.DEFAULT_GAS_LIMIT;
          }
        }
        if (_.isNumber(opts.fee)) {
          // This is used for sendmax
          gasPrice = feePerKb = Number(
            (
              opts.fee / (inGasLimit || Defaults.DEFAULT_GAS_LIMIT)
            ).toFixed()
          );
        }

        const gasLimit = inGasLimit || Defaults.DEFAULT_GAS_LIMIT;
        opts.fee = feePerKb * gasLimit;
        return resolve({feePerKb, gasPrice});
      });
    });
  }

  buildTx(txp) {
    const isERC20 = txp.tokenAddress && !txp.payProUrl;
    const chain = isERC20 ? 'ERC20' : 'ETH';
    const outputs = txp.outputs.map(output => {
      return {
        amount: output.amount,
        address: output.toAddress,
        data: output.data,
        gasLimit: output.gasLimit
      };
    });
    const unsignedTxs = [];
    for (let index = 0; index < outputs.length; index++) {
      const rawTx = Transactions.create({
          ...txp,
          chain,
          data: outputs[index].data,
          gasLimit: outputs[index].gasLimit,
          nonce: Number(txp.nonce) + Number(index),
          recipients: [outputs[index]]
        });
      unsignedTxs.push(rawTx);
    }
    return {
        uncheckedSerialize: () => unsignedTxs,
        txid: () => txp.txid,
        toObject: () => {
          let ret = _.clone(txp);
          ret.outputs[0].satoshis = ret.outputs[0].amount;
          return ret;
        },
        getFee: () => {
          return txp.fee;
        },
        getChangeOutput: () => null,

      };
  }

  convertFeePerKb(p, feePerKb) {
    return [p, feePerKb];
  }

  checkTx(server, txp) {
    try {
      txp.getBitcoreTx();
    } catch (ex) {
      server.logw('Error building Bitcore transaction', ex);
      return ex;
    }
  }

  checkTxUTXOs(server, txp, opts, cb) {
    return cb();
  }

  selectTxInputs(server, txp, wallet, opts, cb, next) {
    server.getBalance({ wallet, tokenAddress: opts.tokenAddress }, (err, balance) => {
      if (err) return next(err);

      const { totalAmount, availableAmount } = balance;
      if (totalAmount < txp.getTotalAmount()) {
        return cb(Errors.INSUFFICIENT_FUNDS);
      } else if (availableAmount < txp.getTotalAmount()) {
        return cb(Errors.LOCKED_FUNDS);
      } else {
        return next(server._checkTx(txp));
      }
    });
  }

  checkUtxos(opts) {}

  setInputs() {}

  isUTXOCoin() { return false; }
  isSingleAddress() { return true; }

  addressFromStorageTransform(network, address): void {
    if (network != 'livenet') {
      const x =  address.address.indexOf(':' + network);
      if (x >= 0) {
        address.address = address.address.substr(0, x);
      }
    }
  }

  addressToStorageTransform(network, address): void {
    if (network != 'livenet')
      address.address += ':' + network;
  }

  addSignaturesToBitcoreTx(tx, inputs, inputPaths, signatures, xpub) {
    if (signatures.length === 0) {
      throw new Error('Signatures Required');
    }

    const chain = 'ETH';
    const unsignedTxs = tx.uncheckedSerialize();
    const signedTxs = [];
    for (let index = 0; index < signatures.length; index++) {
      const signed = Transactions.applySignature({
        chain,
        tx: unsignedTxs[index],
        signature: signatures[index],
      });
      signedTxs.push(signed);

      // bitcore users id for txid...
      tx.id = Transactions.getHash({ tx: signed, chain });
    }
    tx.uncheckedSerialize = () => signedTxs;
  }
}
