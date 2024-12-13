import { Transactions, Validation } from 'crypto-wallet-core';
import { IChain } from '..';
import { Defaults } from '../../common/defaults';
import { Utils } from '../../common/utils';
import { Errors } from '../../errors/errordefinitions';
import logger from '../../logger';
import { IWallet } from '../../model';
import { IAddress } from '../../model/address';
import { WalletService } from '../../server';


export class SolChain implements IChain {
  chain: string;

  constructor() {
    this.chain = 'SOL';
  }

  private convertBitcoreBalance(bitcoreBalance, locked) {
    const { unconfirmed, confirmed, balance } = bitcoreBalance;
    const convertedBalance = {
      totalAmount: balance,
      totalConfirmedAmount: confirmed,
      lockedAmount: locked,
      lockedConfirmedAmount: locked,
      availableAmount: balance - locked,
      availableConfirmedAmount: confirmed - locked,
      byAddress: []
    };
    return convertedBalance;
  }

  getWalletBalance(server, wallet, opts, cb) {
    const bc = server._getBlockchainExplorer(wallet.chain || wallet.coin, wallet.network);

    if (opts.tokenAddress) {
      wallet.tokenAddress = opts.tokenAddress;
    }

    bc.getBalance(wallet, (err, balance) => {
      if (err) {
        return cb(err);
      }
      // getPendingTxs returns all txps when given a native currency
      server.getPendingTxs(opts, (err, txps) => {
        if (err) return cb(err);
        let fees = 0;
        let amounts = 0;

        txps = txps.filter(txp => {
          // Add gas used for tokens when getting native balance
          if (!opts.tokenAddress) {
            fees += txp.fee || 0;
          }
          // Filter tokens when getting native balance
          if (txp.tokenAddress && !opts.tokenAddress) {
            return false;
          }
          amounts += txp.amount;
          return true;
        });

        const lockedSum = (amounts + fees) || 0;  // previously set to 0 if opts.multisigContractAddress
        const convertedBalance = this.convertBitcoreBalance(balance, lockedSum);
        server.storage.fetchAddresses(server.walletId, (err, addresses: IAddress[]) => {
          if (err) return cb(err);
          if (addresses.length > 0) {
            const byAddress = [
              {
                address: addresses[0].address,
                path: addresses[0].path,
                amount: convertedBalance.totalAmount
              }
            ];
            convertedBalance.byAddress = byAddress;
          }
          return cb(null, convertedBalance);
        });
      });
    });
  }

  getFee(server, wallet, opts) {
    return new Promise(resolve => {
      const numSignatures = opts.signatures || 1;
      return resolve({ fee: 5000 * numSignatures });
    });
  }

  getBitcoreTx(txp, opts = { signed: true }) {
    const {
      data,
      outputs,
      payProUrl,
      tokenAddress,
      isTokenSwap,
      multiTx
    } = txp;
    if (multiTx) {
      throw Errors.MULTI_TX_UNSUPPORTED;
    }
    const isSPL = tokenAddress && !payProUrl && !isTokenSwap;
    const chain = isSPL ? `${this.chain}SPL` : this.chain;
    const recipients = outputs.map(output => {
      return {
        amount: output.amount,
        address: output.toAddress,
        data: output.data
      };
    });
    if (data) {
      recipients[0].data = data;
    }
    const unsignedTxs = [];
    for (let index = 0; index < recipients.length; index++) {
      let params = {
        ...recipients[index],
        recipients: [recipients[index]]
      };
      unsignedTxs.push(Transactions.create({ ...txp, chain, ...params }));
    }

    let tx = {
      uncheckedSerialize: () => unsignedTxs,
      txid: () => txp.txid,
      toObject: () => {
        let ret = Utils.deepClone(txp);
        ret.outputs[0].satoshis = ret.outputs[0].amount;
        return ret;
      },
      getFee: () => {
        return txp.fee;
      },
      getChangeOutput: () => null
    };

    if (opts.signed) {
      const sigs = txp.getCurrentSignatures();
      sigs.forEach(x => {
        this.addSignaturesToBitcoreTx(tx, txp.inputs, txp.inputPaths, x.signatures, x.xpub);
      });
    }

    return tx;
  }

  addSignaturesToBitcoreTx(tx, inputs, inputPaths, signatures, xpub) {
    if (signatures.length === 0) {
      throw new Error('Signatures Required');
    }

    const unsignedTxs = tx.uncheckedSerialize();
    const signedTxs = [];
    for (let index = 0; index < signatures.length; index++) {
      const signed = Transactions.applySignature({
        chain: this.chain, // TODO use lowercase always to avoid confusion
        tx: unsignedTxs[index],
        signature: signatures[index]
      });
      signedTxs.push(signed);

      tx.id = Transactions.getHash({ tx: signed, chain: this.chain });
    }
    tx.uncheckedSerialize = () => signedTxs;
  }

  getTransactionCount(server, wallet, from) {
    return new Promise((resolve, reject) => {
      server._getTransactionCount(wallet, from, (err, count) => {
        if (err) return reject(err);
        return resolve(count);
      });
    });
  }

  getWalletSendMaxInfo(server, wallet, opts, cb) {
    server.getBalance({}, (err, balance) => {
      if (err) return cb(err);
      const { availableAmount } = balance;
      const sigs = opts.signatures || 1;
      let fee = sigs * 5000
      return cb(null, {
        utxosBelowFee: 0,
        amountBelowFee: 0,
        amount: availableAmount - fee,
        feePerKb: opts.feePerKb,
        fee
      });
    });
  }

  checkValidTxAmount(output): boolean {
    try {
      if (
        output.amount == null ||
        output.amount < 0 ||
        isNaN(output.amount)
      ) {
        throw new Error('output.amount is not a valid value: ' + output.amount);
      }
      return true;
    } catch (err) {
      logger.warn(`Invalid output amount (${output.amount}) in checkValidTxAmount: $o`, err);
      return false;
    }
  }

  checkTx(txp) {
    try {
      const tx = this.getBitcoreTx(txp);
    } catch (ex) {
      logger.debug('Error building Bitcore transaction: %o', ex);
      return ex;
    }

    return null;
  }

  selectTxInputs(server, txp, wallet, _opts, cb) {
    server.getBalance({ wallet }, (err, balance) => {
      if (err) return cb(err);
      const { totalAmount, availableAmount } = balance;
      // calculate how much spave is needed to find rent amount
      const minRentException = Defaults.MIN_XRP_BALANCE;
      if (totalAmount - minRentException < txp.getTotalAmount()) {
        return cb(Errors.INSUFFICIENT_FUNDS);
      } else if (availableAmount < txp.getTotalAmount()) {
        return cb(Errors.LOCKED_FUNDS);
      } else {
        return cb(this.checkTx(txp));
      }
    });
  }

  validateAddress(wallet, inaddr, opts) {
    const chain = this.chain.toLowerCase();
    const isValidTo = Validation.validateAddress(chain, wallet.network, inaddr);
    if (!isValidTo) {
      throw Errors.INVALID_ADDRESS;
    }
    const isValidFrom = Validation.validateAddress(chain, wallet.network, opts.from);
    if (!isValidFrom) {
      throw Errors.INVALID_ADDRESS;
    }
    return;
  }

  addressFromStorageTransform(network, address): void {
    if (network != 'livenet') {
      const x = address.address.indexOf(':' + network);
      if (x >= 0) {
        address.address = address.address.substr(0, x);
      }
    }
  }

  addressToStorageTransform(network, address): void {
    if (network != 'livenet') address.address += ':' + network;
  }


  getMinimumRent(server: WalletService, wallet: IWallet, cb: (err?, reserve?: number) => void) {
    const bc = server._getBlockchainExplorer(wallet.chain || wallet.coin, wallet.network);
    bc.getReserve((err, reserve) => {
      if (err) {
        return cb(err);
      }
      return cb(null, reserve);
    });
  }

  getReserve(server: WalletService, wallet: IWallet, cb: (err?, reserve?: number) => void) {
    return cb(null, 0);
  }
  getSizeSafetyMargin() {
    return 0;
  }

  getInputSizeSafetyMargin() {
    return 0;
  }

  notifyConfirmations() {
    return false;
  }

  supportsMultisig() {
    return false;
  }

  isUTXOChain() {
    return false;
  }

  isSingleAddress() {
    return true;
  }

  getDustAmountValue() {
    return 0;
  }

  getChangeAddress() { }

  checkDust(_output, _opts) { }

  checkScriptOutput(output) { }

  onCoin(coin) {
    return null;
  }

  convertFeePerKb(p, feePerKb) {
    return [p, feePerKb];
  }

  checkTxUTXOs(server, txp, opts, cb) {
    return cb();
  }

  checkUtxos(opts) { }

  onTx(tx) {
    return null;
  }
}
