import { Router } from 'express';
import logger from '../../../../logger';
import { BaseSVMStateProvider } from './csp';

export class SVMRouter {
  private router: Router;
  private csp: BaseSVMStateProvider;
  private chain: string;

  constructor(csp: BaseSVMStateProvider, chain: string, _params?: any) {
    this.csp = csp;
    this.chain = chain?.toUpperCase();
    this.router = Router();
    this.setDefaultRoutes(this.router);
  };

  public getRouter() {
    return this.router;
  };

  private setDefaultRoutes(router: Router) {
    this.estimateTxFee(router);
    this.getPriorityFee(router);
    this.getRentMinimum(router);
  };

  private estimateTxFee(router: Router) {
    router.post(`/api/${this.chain}/:network/txFee`, async (req, res) => {
      const { rawTx } = req.body;
      const { network } = req.params;
      try {
        res.json(await this.csp.getFee({ network, rawTx }));
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

  private getPriorityFee(router: Router) {
    router.get(`/api/${this.chain}/:network/priorityFee/:percentile`, async (req, res) => {
      let { percentile, network } = req.params;
      const priorityFeePercentile = Number(percentile) || 15;

      network = network.toLowerCase();
      try {
        let fee = await this.csp.getPriorityFee({ chain: this.chain, network, percentile: priorityFeePercentile });
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

  private getRentMinimum(router: Router) {
    router.get(`/api/${this.chain}/:network/rent/:space`, async (req, res) => {
      const { network, space } = req.params;
      try {
        const minimum = await this.csp.getRentExemptionAmount({ network, space });
        res.json(minimum);
      } catch (err: any) {
        if (err?.code != null) {
          res.status(400).send(err.message);
        } else {
          logger.error('Rent Error::%o', err.stack || err.message || err);
          res.status(500).send(err.message || err);
        }
      }
    });
  };
}
