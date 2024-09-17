import cors from 'cors';
import { Router } from 'express';
import Web3 from 'web3';
import config from '../../../../config';
import logger from '../../../../logger';
import { WebhookStorage } from '../../../../models/webhook';
import { Config } from '../../../../services/config';
import { BaseEVMStateProvider } from './csp';
import { Gnosis } from './gnosis';

export class EVMRouter {
  private router: Router;
  private csp: BaseEVMStateProvider;
  private chain: string;

  constructor(csp: BaseEVMStateProvider, chain: string, params?: any) {
    this.csp = csp;
    this.chain = chain?.toUpperCase();
    this.router = Router();
    this.router.param('network', (req, _res, next) => {
      const { network: beforeNetwork } = req.params;
      const { network } = Config.aliasFor({ chain: this.chain, network: beforeNetwork });
      req.params.network = network;
      next();
    });
    this.setDefaultRoutes(this.router);
    if (params?.multisig) {
      this.setMultiSigRoutes(this.router);
    }
    this.setWebhooks(this.router);
  };

  public getRouter() {
    return this.router;
  };

  private setDefaultRoutes(router: Router) {
    this.getAccountNonce(router);
    this.estimateGas(router);
    this.getTokenInfo(router);
    this.getERC20TokenAllowance(router);
    this.getPriorityFee(router);
  };
  
  private setMultiSigRoutes(router: Router) {
    this.getMultisigEthInfo(router);
    this.getMultisigContractInstantiationInfo(router);
    this.getMultisigTxpsInfo(router);
    this.streamGnosisWalletTransactions(router);
  };

  private setWebhooks(router: Router) {
    this.postMoralisWebhook(router);
  }

  private getAccountNonce(router: Router) {
    router.get(`/api/${this.chain}/:network/address/:address/txs/count`, async (req, res) => {
      let { address, network } = req.params;
      try {
        const nonce = await this.csp.getAccountNonce(network, address);
        res.json({ nonce });
      } catch (err: any) {
        logger.error('Nonce Error::%o', err.stack || err.message || err);
        res.status(500).send(err.message || err);
      }
    });
  };

  private estimateGas(router: Router) {
    router.post(`/api/${this.chain}/:network/gas`, async (req, res) => {
      const { from, to, value, data, gasPrice } = req.body;
      const { network } = req.params;
      try {
        const gasLimit = await this.csp.estimateGas({ network, from, to, value, data, gasPrice });
        res.json(gasLimit);
      } catch (err: any) {
        if (err?.code != null) { // Preventable error from geth (probably due to insufficient funds or similar)
          res.status(400).send(err.message);
        } else {
          logger.error('Gas Error::%o', err.stack || err.message || err);
          res.status(500).send(err.message || err);
        }
      }
    });
  };

  private getTokenInfo(router: Router) {
    router.get(`/api/${this.chain}/:network/token/:tokenAddress`, async (req, res) => {
      const { network, tokenAddress } = req.params;
      try {
        const tokenInfo = await this.csp.getERC20TokenInfo(network, tokenAddress);
        res.json(tokenInfo);
      } catch (err: any) {
        logger.error('Token Info Error::%o', err.stack || err.message || err);
        res.status(500).send(err.message || err);
      }
    });
  };

  private getERC20TokenAllowance(router: Router) {
    router.get(`/api/${this.chain}/:network/token/:tokenAddress/allowance/:ownerAddress/for/:spenderAddress`, async (req, res) => {
      const { network, tokenAddress, ownerAddress, spenderAddress } = req.params;
      try {
        const allowance = await this.csp.getERC20TokenAllowance(network, tokenAddress, ownerAddress, spenderAddress);
        res.json(allowance);
      } catch (err: any) {
        logger.error('Token Allowance Error::%o', err.stack || err.message || err);
        res.status(500).send(err.message || err);
      }
    });
  };

  private getPriorityFee(router: Router) {
    router.get(`/api/${this.chain}/:network/priorityFee/:percentile`, async (req, res) => {
      let { percentile, network } = req.params;
      const priorityFeePercentile = Number(percentile) || 15;
    
      network = network.toLowerCase();
      try {
        let fee = await this.csp.getPriorityFee({ network, percentile: priorityFeePercentile });
        if (!fee) {
          return res.status(404).send('not available right now');
        }
        return res.json(fee);
      } catch (err: any) {
        logger.error('Fee Error: %o', err.stack || err.message || err);
        return res.status(500).send('Error getting priority fee from RPC');
      }
    });
  };

  private streamGnosisWalletTransactions(router: Router) { 
    router.get(`/api/${this.chain}/:network/ethmultisig/transactions/:multisigContractAddress`, async (req, res) => {
      let { network, multisigContractAddress } = req.params;
      try {
        return await Gnosis.streamGnosisWalletTransactions({
          chain: this.chain,
          network,
          multisigContractAddress,
          wallet: {} as any,
          req,
          res,
          args: req.query
        });
      } catch (err: any) {
        logger.error('Multisig Transactions Error::%o', err.stack || err.message || err);
        return res.status(500).send(err.message || err);
      }
    });
  };

  private getMultisigTxpsInfo(router: Router) {
    router.get(`/api/${this.chain}/:network/ethmultisig/txps/:multisigContractAddress`, async (req, res) => {
      const { network, multisigContractAddress } = req.params;
      try {
        const multisigTxpsInfo = await Gnosis.getMultisigTxpsInfo(this.chain, network, multisigContractAddress);
        res.json(multisigTxpsInfo);
      } catch (err: any) {
        logger.error('Multisig Txps Error::%o', err.stack || err.message || err);
        res.status(500).send(err.message || err);
      }
    });
  };

  private getMultisigContractInstantiationInfo(router: Router) {
    router.get(`/api/${this.chain}/:network/ethmultisig/:sender/instantiation/:txId`, async (req, res) => {
      const { network, sender, txId } = req.params;
      try {
        const multisigInstantiationInfo = await Gnosis.getMultisigContractInstantiationInfo(this.chain, network, sender, txId);
        res.json(multisigInstantiationInfo);
      } catch (err: any) {
        logger.error('Multisig Instantiation Error::%o', err.stack || err.message || err);
        res.status(500).send(err.message || err);
      }
    });
  };

  private getMultisigEthInfo(router: Router) {
    router.get(`/api/${this.chain}/:network/ethmultisig/info/:multisigContractAddress`, async (req, res) => {
      const { network, multisigContractAddress } = req.params;
      try {
        const multisigInfo = await Gnosis.getMultisigInfo(this.chain, network, multisigContractAddress);
        res.json(multisigInfo);
      } catch (err: any) {
        logger.error('Multisig Info Error::%o', err.stack || err.message || err);
        res.status(500).send(err.message || err);
      }
    });
  };


  private _validateMoralisWebhook(req, res, next) {
    const secret = config.externalProviders?.moralis?.streamSecret;
    if (!secret) {
      return res.status(404).send('Moralis not configured');
    }
    const reqSig = req.headers['x-signature'];
    if (!reqSig) {
      return res.status(400).send('Signature not provided');
    }
    const computedSig = Web3.utils.sha3(JSON.stringify(req.body) + secret);
    if (reqSig !== computedSig) {
      return res.status(406).send('Unauthorized');
    }
    next();
  }

  private postMoralisWebhook(router: Router) {
    const webhookCors = config.externalProviders?.moralis?.webhookCors;
    router.post(`/webhook/${this.chain}/:network/moralis`, cors(webhookCors), this._validateMoralisWebhook, async (req, res) => {
      try {
        const { network } = req.params;

        if (req.body.chainId === '') {
          // This is a webhook test call from moralis
          return res.end();
        }

        await WebhookStorage.collection.insertOne({
          chain: this.chain,
          network,
          source: 'moralis',
          sourceId: req.body.streamId,
          tag: req.body.tag,
          body: req.body,
          timestamp: new Date(),
          processed: false
        });
        return res.end();
      } catch (err: any) {
        logger.error('Error processing moralis webhook: %o', err.stack || err.message || err);
        return res.status(500).send('Unable to process webhook');
      }
    });
  }
}
