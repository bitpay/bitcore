import { Transactions, Validation } from 'crypto-wallet-core';
import { Web3 } from 'crypto-wallet-core';
import _ from 'lodash';
import { IAddress } from 'src/lib/model/address';
import { IChain } from '..';
import { Common } from '../../common';
import { ClientError } from '../../errors/clienterror';
import { Errors } from '../../errors/errordefinitions';
import logger from '../../logger';
import { ERC20Abi } from './abi-erc20';
import { InvoiceAbi } from './abi-invoice';

const { toBN } = Web3.utils;
const Constants = Common.Constants;
const Defaults = Common.Defaults;

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

  getWalletBalance(server, wallet, opts, cb) {
    const bc = server._getBlockchainExplorer(wallet.chain || wallet.coin, wallet.network);

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

  getChangeAddress() { }

  checkDust(output, opts) { }

  getFee(server, wallet, opts) {
    return new Promise(resolve => {
      server._getFeePerKb(wallet, opts, async (err, inFeePerKb) => {
        let feePerKb = inFeePerKb;
        let gasPrice = inFeePerKb;
        const { from } = opts;
        const { coin, network } = wallet;
        let inGasLimit = 0; // Per recepient gas limit
        let gasLimit = 0; // Gas limit for all recepients. used for contract interactions that rollup recepients
        let fee = 0;
        const defaultGasLimit = this.getDefaultGasLimit(opts);
        let outputAddresses = []; // Parameter for MuliSend contract
        let outputAmounts = []; // Parameter for MuliSend contract
        let totalValue = toBN(0); // Parameter for MuliSend contract

        for (let output of opts.outputs) {
          if (opts.multiSendContractAddress) {
            outputAddresses.push(output.toAddress);
            outputAmounts.push(toBN(BigInt(output.amount).toString()));
            if (!opts.tokenAddress) {
              totalValue = totalValue.add(toBN(BigInt(output.amount).toString()));
            }
            inGasLimit += output.gasLimit ? output.gasLimit : defaultGasLimit;
            continue;
          } else if (!output.gasLimit) {
            try {
              const to = opts.payProUrl
                ? output.toAddress
                : opts.tokenAddress
                  ? opts.tokenAddress
                  : opts.multisigContractAddress
                    ? opts.multisigContractAddress
                    : output.toAddress;
              const value = opts.tokenAddress || opts.multisigContractAddress ? 0 : output.amount;
              inGasLimit = await server.estimateGas({
                coin,
                network,
                from,
                to,
                value,
                data: output.data,
                gasPrice
              });
              output.gasLimit = inGasLimit || defaultGasLimit;
            } catch (err) {
              output.gasLimit = defaultGasLimit;
            }
          } else {
            inGasLimit = output.gasLimit;
          }
          if (_.isNumber(opts.fee)) {
            // This is used for sendmax
            gasPrice = feePerKb = Number((opts.fee / (inGasLimit || defaultGasLimit)).toFixed());
          }
          gasLimit = inGasLimit || defaultGasLimit;
          fee += feePerKb * gasLimit;
        }

        if (opts.multiSendContractAddress) {
          try {
            const data = this.encodeContractParameters(
              Constants.BITPAY_CONTRACTS.MULTISEND,
              { addresses: outputAddresses, amounts: outputAmounts },
              opts
            );

            gasLimit = await server.estimateGas({
              coin,
              network,
              from,
              to: opts.multiSendContractAddress,
              value: totalValue.toString(),
              data,
              gasPrice
            });
            gasLimit += Math.ceil(gasLimit * Defaults.MS_GAS_LIMIT_BUFFER_PERCENT); // gas limit buffer
          } catch (error) {
            logger.error('Error estimating gas for MultiSend contract: %o', error);
          }
          gasLimit = gasLimit ? gasLimit : inGasLimit;
          fee += feePerKb * gasLimit;
        }
        return resolve({ feePerKb, gasPrice, gasLimit, fee });
      });
    });
  }

  getBitcoreTx(txp, opts = { signed: true }) {
    const {
      data,
      outputs,
      payProUrl,
      tokenAddress,
      multisigContractAddress,
      multiSendContractAddress,
      isTokenSwap
    } = txp;
    const isERC20 = tokenAddress && !payProUrl && !isTokenSwap;
    const isETHMULTISIG = multisigContractAddress;
    const chain = isETHMULTISIG ? 'ETHMULTISIG' : isERC20 ? 'ETHERC20' : 'ETH';
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

    if (multiSendContractAddress) {
      let multiSendParams = {
        nonce: Number(txp.nonce),
        recipients,
        contractAddress: multiSendContractAddress
      };
      unsignedTxs.push(Transactions.create({ ...txp, chain, ...multiSendParams }));
    } else {
      for (let index = 0; index < recipients.length; index++) {
        let params = {
          ...recipients[index],
          nonce: Number(txp.nonce) + Number(index),
          recipients: [recipients[index]]
        };
        unsignedTxs.push(Transactions.create({ ...txp, chain, ...params }));
      }
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

  getDefaultGasLimit(opts) {
    let defaultGasLimit = opts.tokenAddress ? Defaults.DEFAULT_ERC20_GAS_LIMIT : Defaults.DEFAULT_GAS_LIMIT;
    if (opts.multiSendContractAddress) {
      defaultGasLimit = opts.tokenAddress
        ? Defaults.DEFAULT_MULTISEND_RECIPIENT_ERC20_GAS_LIMIT
        : Defaults.DEFAULT_MULTISEND_RECIPIENT_GAS_LIMIT;
    }
    return defaultGasLimit;
  }

  encodeContractParameters(contract, params, opts) {
    if (contract === Constants.BITPAY_CONTRACTS.MULTISEND) {
      const web3 = new Web3();
      return {
        addresses: web3.eth.abi.encodeParameter('address[]', params.addresses),
        amounts: web3.eth.abi.encodeParameter('uint256[]', params.amounts),
        method: opts.tokenAddress ? 'sendErc20' : 'sendEth',
        tokenAddress: opts.tokenAddress,
        type: Constants.BITPAY_CONTRACTS.MULTISEND
      };
    }
  }

  convertFeePerKb(p, feePerKb) {
    return [p, feePerKb];
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
                return cb(this.getInsufficientFeeError(txp));
              } else if (availableAmount < txp.fee) {
                return cb(this.getLockedFeeError(txp));
              } else {
                return cb(this.checkTx(txp));
              }
            });
          } else if (availableAmount - txp.fee < txpTotalAmount) {
            return cb(
              new ClientError(
                Errors.codes.INSUFFICIENT_FUNDS_FOR_FEE,
                `${Errors.INSUFFICIENT_FUNDS_FOR_FEE.message}. RequiredFee: ${txp.fee}`,
                {
                  requiredFee: txp.fee
                }
              )
            );
          } else {
            return cb(this.checkTx(txp));
          }
        }
      }
    );
  }

  getInsufficientFeeError(txp) {
    return new ClientError(
      Errors.codes.INSUFFICIENT_ETH_FEE,
      `${Errors.INSUFFICIENT_ETH_FEE.message}. RequiredFee: ${txp.fee}`,
      {
        requiredFee: txp.fee
      }
    );
  }

  getLockedFeeError(txp) {
    return new ClientError(Errors.codes.LOCKED_ETH_FEE, `${Errors.LOCKED_ETH_FEE.message}. RequiredFee: ${txp.fee}`, {
      requiredFee: txp.fee
    });
  }

  checkUtxos(opts) { }

  checkValidTxAmount(output): boolean {
    try {
      if (
        output.amount == null ||
        output.amount < 0 ||
        isNaN(output.amount) ||
        Web3.utils.toBN(BigInt(output.amount).toString()).toString() !== BigInt(output.amount).toString()
      ) {
        throw new Error('output.amount is not a valid value: ' + output.amount);
      }
      return true;
    } catch (err) {
      logger.warn(`Invalid output amount (${output.amount}) in checkValidTxAmount: $o`, err);
      return false;
    }
  }

  isUTXOChain() {
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

    const chain = 'ETH'; // TODO use lowercase always to avoid confusion
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
    const chain = 'eth';
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
    // Only returns single notification so determine most precise
    if (tx.effects && tx.effects.length) {
      const multisigConfirm = tx.effects.findIndex(e => e.type === 'MULTISIG:confirmTransaction');
      const multisigSubmit = tx.effects.findIndex(e => e.type === 'MULTISIG:submitTransaction');
      const erc20Transfer = tx.effects.findIndex(e => e.type === 'ERC20:transer');
      const internalTransfer = tx.effects.findIndex(e => !e.type && !e.contractAddress);
      
      const exists = [multisigConfirm, multisigSubmit, erc20Transfer, internalTransfer].filter(i => i > -1);
      
      if (exists.length) {
        // Get the first effect based on priority as determined by order in above array
        const best = tx.effects[exists[0]];
        if (best.type == 'MULTISIG:confirmTransaction' || best.type == 'MULTISIG:submitTransaction') {
          multisigContractAddress = best.contractAddress;
          address = best.to;
          amount = best.amount;
        } else if (best.type == 'ERC20:transfer') {
          tokenAddress = best.contractAddress;
          address = best.to;
          amount = best.amount;
        } else {
          address = best.to;
          amount = best.amount;
        }
      }
    } 
    
    // If we haven't defined address by this point then it must be native transfer
    if (!address) {
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
