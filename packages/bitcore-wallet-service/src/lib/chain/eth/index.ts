import { Transactions, Validation } from 'crypto-wallet-core';
import { Web3 } from 'crypto-wallet-core';
import _ from 'lodash';
import { IAddress } from 'src/lib/model/address';
import { IChain, INotificationData } from '..';
import logger from '../../logger';
import { ERC20Abi } from './abi-erc20';
import { InvoiceAbi } from './abi-invoice';

const Common = require('../../common');
const Constants = Common.Constants;
const Defaults = Common.Defaults;
const Errors = require('../../errors/errordefinitions');

function requireUncached(module) {
  delete require.cache[require.resolve(module)];
  return require(module);
}

const Erc20Decoder = requireUncached('abi-decoder');
Erc20Decoder.addABI(ERC20Abi);
function getErc20Decoder() {
  return Erc20Decoder;
}

const InvoiceDecoder = requireUncached('abi-decoder');
InvoiceDecoder.addABI(InvoiceAbi);
function getInvoiceDecoder() {
  return InvoiceDecoder;
}

export class EthChain implements IChain {
  /**
   * Converts Bitcore Balance Response.
   * @param {Object} bitcoreBalance - { unconfirmed, confirmed, balance }
   * @param {Number} locked - Sum of txp.amount
   * @returns {Object} balance - Total amount & locked amount.
   */
  private convertBitcoreBalance(bitcoreBalance, locked) {
    const { unconfirmed, confirmed, balance } = bitcoreBalance;
    // we ASUME all locked as confirmed, for ETH.
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

  notifyConfirmations() {
    return false;
  }

  supportsMultisig() {
    return false;
  }

  getWalletBalance(server, wallet, opts, cb) {
    const bc = server._getBlockchainExplorer(wallet.coin, wallet.network);

    if (opts.tokenAddress) {
      wallet.tokenAddress = opts.tokenAddress;
    }

    if (opts.multisigContractAddress) {
      wallet.multisigContractAddress = opts.multisigContractAddress;
      opts.network = wallet.network;
    }

    bc.getBalance(wallet, (err, balance) => {
      if (err) {
        return cb(err);
      }
      server.getPendingTxs(opts, (err, txps) => {
        if (err) return cb(err);
        // Do not lock eth multisig amount
        const lockedSum = opts.multisigContractAddress ? 0 : _.sumBy(txps, 'amount') || 0;
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

  getWalletSendMaxInfo(server, wallet, opts, cb) {
    server.getBalance({}, (err, balance) => {
      if (err) return cb(err);
      const { totalAmount, availableAmount } = balance;
      let fee = opts.feePerKb * Defaults.MIN_GAS_LIMIT;
      return cb(null, {
        utxosBelowFee: 0,
        amountBelowFee: 0,
        amount: availableAmount - fee,
        feePerKb: opts.feePerKb,
        fee
      });
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
      server._getFeePerKb(wallet, opts, async (err, inFeePerKb) => {
        let feePerKb = inFeePerKb;
        let gasPrice = inFeePerKb;
        const { from } = opts;
        const { coin, network } = wallet;
        let inGasLimit;
        let gasLimit;
        let fee = 0;
        for (let output of opts.outputs) {
          if (!output.gasLimit) {
            try {
              inGasLimit = await server.estimateGas({
                coin,
                network,
                from,
                to: opts.multisigContractAddress || (opts.tokenAddress && !opts.payProUrl) || output.toAddress,
                value: opts.tokenAddress || opts.multisigContractAddress ? 0 : output.amount,
                data: output.data,
                gasPrice
              });
              output.gasLimit = inGasLimit || Defaults.DEFAULT_GAS_LIMIT;
            } catch (err) {
              output.gasLimit = Defaults.DEFAULT_GAS_LIMIT;
            }
          } else {
            inGasLimit = output.gasLimit;
          }
          if (_.isNumber(opts.fee)) {
            // This is used for sendmax
            gasPrice = feePerKb = Number((opts.fee / (inGasLimit || Defaults.DEFAULT_GAS_LIMIT)).toFixed());
          }
          gasLimit = inGasLimit || Defaults.DEFAULT_GAS_LIMIT;
          fee += feePerKb * gasLimit;
        }
        return resolve({ feePerKb, gasPrice, gasLimit, fee });
      });
    });
  }

  getBitcoreTx(txp, opts = { signed: true }) {
    const { data, outputs, payProUrl, tokenAddress, multisigContractAddress } = txp;
    const isERC20 = tokenAddress && !payProUrl;
    const isETHMULTISIG = multisigContractAddress;
    const chain = isETHMULTISIG ? 'ETHMULTISIG' : isERC20 ? 'ERC20' : 'ETH';
    const recipients = outputs.map(output => {
      return {
        amount: output.amount,
        address: output.toAddress,
        data: output.data,
        gasLimit: output.gasLimit
      };
    });
    // Backwards compatibility BWC <= 8.9.0
    if (data) {
      recipients[0].data = data;
    }
    const unsignedTxs = [];
    for (let index = 0; index < recipients.length; index++) {
      const rawTx = Transactions.create({
        ...txp,
        ...recipients[index],
        chain,
        nonce: Number(txp.nonce) + Number(index),
        recipients: [recipients[index]]
      });
      unsignedTxs.push(rawTx);
    }

    let tx = {
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

  convertFeePerKb(p, feePerKb) {
    return [p, feePerKb];
  }

  checkTx(txp) {
    try {
      const tx = this.getBitcoreTx(txp);
    } catch (ex) {
      logger.debug('Error building Bitcore transaction', ex);
      return ex;
    }

    return null;
  }

  checkTxUTXOs(server, txp, opts, cb) {
    return cb();
  }

  selectTxInputs(server, txp, wallet, opts, cb) {
    server.getBalance(
      { wallet, tokenAddress: opts.tokenAddress, multisigContractAddress: opts.multisigContractAddress },
      (err, balance) => {
        if (err) return cb(err);

        const getInvoiceValue = txp => {
          let totalAmount;

          /* invoice outputs data example:
          abiDecoder.decodeMethod(txp.outputs[0].data)
          { name: 'approve',
            params:
            [ { name: '_spender',
                value: '0xc27ed3df0de776246cdad5a052a9982473fceab8',
                type: 'address' },
              { name: '_value', value: '1380623310000000', type: 'uint256' } ] }

          > abiDecoder.decodeMethod(txp.outputs[1].data)
          { name: 'pay',
            params:
            [ { name: 'value', value: '1000000', type: 'uint256' },
              { name: 'gasPrice', value: '40000000000', type: 'uint256' },
              { name: 'expiration', value: '1604123733282', type: 'uint256' },
              ... ] }
          */

          txp.outputs.forEach(output => {
            // We use a custom contract call (pay) instead of the transfer ERC20 method
            const decodedData = getInvoiceDecoder().decodeMethod(output.data);
            if (decodedData && decodedData.name === 'pay') {
              totalAmount = decodedData.params[0].value;
            }
          });
          return totalAmount;
        };

        const { totalAmount, availableAmount } = balance;

        /* If its paypro its an already created ERC20 transaction and we need to get the actual invoice value from the data
        invoice outputs example:
        "outputs":[{
            "amount":0,
            "toAddress":"0x44d69d16C711BF966E3d00A46f96e02D16BDdf1f",
            "message":null,
            "data":"...",
            "gasLimit":29041
          },
          {
            "amount":0,
            "toAddress":"0xc27eD3DF0DE776246cdAD5a052A9982473FceaB8",
            "message":null,
            "data":"...",
            "gasLimit":200000
        }]
        */
        const txpTotalAmount =
          (opts.multisigContractAddress || opts.tokenAddress) && txp.payProUrl
            ? getInvoiceValue(txp)
            : txp.getTotalAmount(opts);

        if (totalAmount < txpTotalAmount) {
          return cb(Errors.INSUFFICIENT_FUNDS);
        } else if (availableAmount < txpTotalAmount) {
          return cb(Errors.LOCKED_FUNDS);
        } else {
          if (opts.tokenAddress || opts.multisigContractAddress) {
            // ETH linked wallet balance
            server.getBalance({}, (err, ethBalance) => {
              if (err) return cb(err);
              const { totalAmount, availableAmount } = ethBalance;
              if (totalAmount < txp.fee) {
                return cb(Errors.INSUFFICIENT_ETH_FEE);
              } else if (availableAmount < txp.fee) {
                return cb(Errors.LOCKED_ETH_FEE);
              } else {
                return cb(this.checkTx(txp));
              }
            });
          } else {
            return cb(this.checkTx(txp));
          }
        }
      }
    );
  }

  checkUtxos(opts) {}

  checkValidTxAmount(output): boolean {
    if (!_.isNumber(output.amount) || _.isNaN(output.amount) || output.amount < 0) {
      return false;
    }
    return true;
  }

  isUTXOCoin() {
    return false;
  }
  isSingleAddress() {
    return true;
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
        signature: signatures[index]
      });
      signedTxs.push(signed);

      // bitcore users id for txid...
      tx.id = Transactions.getHash({ tx: signed, chain });
    }
    tx.uncheckedSerialize = () => signedTxs;
  }

  validateAddress(wallet, inaddr, opts) {
    const chain = 'ETH';
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

  onCoin(coin) {
    return null;
  }

  onTx(tx) {
    // TODO: Multisig ERC20 - Internal txs ¿?
    let tokenAddress;
    let multisigContractAddress;
    let address;
    let amount;
    if (tx.abiType && tx.abiType.type === 'ERC20') {
      tokenAddress = tx.to;
      address = Web3.utils.toChecksumAddress(tx.abiType.params[0].value);
      amount = tx.abiType.params[1].value;
    } else if (tx.abiType && tx.abiType.type === 'MULTISIG' && tx.abiType.name === 'submitTransaction') {
      multisigContractAddress = tx.to;
      address = Web3.utils.toChecksumAddress(tx.abiType.params[0].value);
      amount = tx.abiType.params[1].value;
    } else if (tx.abiType && tx.abiType.type === 'MULTISIG' && tx.abiType.name === 'confirmTransaction') {
      multisigContractAddress = tx.to;
      address = Web3.utils.toChecksumAddress(tx.internal[0].action.to);
      amount = tx.internal[0].action.value;
    } else {
      address = tx.to;
      amount = tx.value;
    }
    return {
      txid: tx.txid,
      out: {
        address,
        amount,
        tokenAddress,
        multisigContractAddress
      }
    };
  }
}
