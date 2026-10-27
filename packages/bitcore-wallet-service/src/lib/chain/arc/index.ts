import { Constants, ethers } from '@bitpay-labs/crypto-wallet-core';
import { ClientError } from '../../errors/clienterror';
import { EthChain } from '../eth';
import { ERC20Abi } from '../eth/abi-erc20';
import type { TxProposal } from '../../model/txproposal';

const usdcInterface = new ethers.Interface(ERC20Abi);

export class ArcChain extends EthChain {
  constructor() {
    super();
    this.chain = 'ARC';
  }

  private isUsdcTokenView(opts) {
    return opts.tokenAddress?.toLowerCase() === Constants.ARC.USDC_CONTRACT_ADDRESS;
  }

  protected getAdditionalNativeAmount(txp: TxProposal): bigint {
    if (txp.tokenAddress || txp.multisigContractAddress || txp.multiSendContractAddress) return 0n;

    try {
      return (txp.outputs || []).reduce((total, output) => {
        if (output.toAddress?.toLowerCase() !== Constants.ARC.USDC_CONTRACT_ADDRESS) return total;
        const data = output.data || txp.data;
        if (!data || data === '0x') return total;
        const call = usdcInterface.parseTransaction({ data });
        let amount = 0n;
        if (call?.name === 'transfer') {
          amount = call.args[1];
        } else if (call?.name === 'transferFrom' && call.args[0].toLowerCase() === txp.from?.toLowerCase()) {
          amount = call.args[2];
        }
        // The ERC20 interface uses 6 decimals; the same native balance uses 18.
        return total + amount * 10n ** 12n;
      }, 0n);
    } catch {
      throw new ClientError('Invalid Arc USDC contract call data');
    }
  }

  getWalletBalance(server, wallet, opts, cb) {
    // Native USDC and its ERC-20 view share funds. A separate token balance would
    // use different units and omit the native spend locked by pending proposals.
    if (this.isUsdcTokenView(opts)) {
      return cb(new ClientError('USDC is the native Arc balance; omit tokenAddress'));
    }
    return super.getWalletBalance(server, wallet, opts, cb);
  }

  getWalletSendMaxInfo(server, wallet, opts, cb) {
    const onFee = (err, feePerKb?) => {
      if (err) return cb(err);
      feePerKb = Number(feePerKb);
      if (!Number.isFinite(feePerKb) || feePerKb < Constants.ARC.MIN_GAS_PRICE) {
        return cb(new ClientError('Arc gas price must be at least 20 gwei'));
      }
      return super.getWalletSendMaxInfo(server, wallet, { ...opts, feePerKb }, cb);
    };
    // Match the type-2 cap reserved when creating the proposal.
    if (Number(opts.txType) === 2) {
      return server.estimateFee({ network: wallet.network, chain: wallet.chain, txType: 2 })
        .then(feePerKb => onFee(null, feePerKb), onFee);
    }
    return server._getFeePerKb(wallet, opts, onFee);
  }

  async getFee(server, wallet, opts) {
    if (this.isUsdcTokenView(opts)) {
      throw new ClientError('USDC is the native Arc asset; omit tokenAddress');
    }
    const fees = await super.getFee(server, wallet, opts) as { gasPrice: number; maxGasFee?: number; gasLimit: number };
    const gasPrice = Number(Number(opts.txType) === 2 ? fees.maxGasFee : fees.gasPrice);
    if (!Number.isFinite(gasPrice) || gasPrice < Constants.ARC.MIN_GAS_PRICE) {
      throw new ClientError('Arc gas price must be at least 20 gwei');
    }
    // Reserve the fee actually encoded in the transaction, including type-2 caps.
    return { ...fees, fee: gasPrice * fees.gasLimit };
  }

  checkDust(output, opts) {
    if (!opts.tokenAddress && output.amount > 0 &&
        output.toAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      return new ClientError('Native USDC cannot be sent to the zero address on Arc');
    }
  }
}
