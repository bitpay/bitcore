import { Transactions, Validation } from 'crypto-wallet-core';
import _ from 'lodash';
import { ClientError } from '../../errors/clienterror';
import { Errors } from '../../errors/errordefinitions';
import { EthChain } from '../eth';


export class MaticChain extends EthChain {
  /**
   * Converts Bitcore Balance Response.
   * @param {Object} bitcoreBalance - { unconfirmed, confirmed, balance }
   * @param {Number} locked - Sum of txp.amount
   * @returns {Object} balance - Total amount & locked amount.
   */

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
    const isMATICMULTISIG = multisigContractAddress;
    const chain = isMATICMULTISIG ? 'MATICMULTISIG' : isERC20 ? 'MATICERC20' : 'MATIC';
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
        const rawTx = Transactions.create({
          ...txp,
          ...recipients[index],
          chain,
          nonce: Number(txp.nonce) + Number(index),
          recipients: [recipients[index]]
        });
        unsignedTxs.push(rawTx);
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

  addSignaturesToBitcoreTx(tx, inputs, inputPaths, signatures, xpub) {
    if (signatures.length === 0) {
      throw new Error('Signatures Required');
    }

    const chain = 'MATIC';
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
    const chain = 'MATIC';
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

  getInsufficientFeeError(txp) {
    return new ClientError(
      Errors.codes.INSUFFICIENT_MATIC_FEE,
      `${Errors.INSUFFICIENT_MATIC_FEE.message}. RequiredFee: ${txp.fee}`,
      {
        requiredFee: txp.fee
      }
    );
  }

  getLockedFeeError(txp) {
    return new ClientError(
      Errors.codes.LOCKED_MATIC_FEE,
      `${Errors.LOCKED_MATIC_FEE.message}. RequiredFee: ${txp.fee}`,
      {
        requiredFee: txp.fee
      }
    );
  }
}
