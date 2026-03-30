import express from 'express';
import * as Types from '../../types/expressapp';

interface AaveRouterOpts {
  returnError: Types.ReturnErrorFn;
  getServer: Types.GetServerFn;
}

export class AaveRouter {
  router: express.Router;

  constructor(params: AaveRouterOpts) {
    const { returnError, getServer } = params;
    const router = express.Router();

    router.post('/v1/service/aave/userAccountData', async (req, res) => {
      try {
        const server = getServer(req, res);
        const accountData = await server.getAaveUserAccountData(req.body);
        res.json(accountData);
      } catch (err) {
        returnError(err, res, req);
      }
    });

    router.post('/v1/service/aave/reserveData', async (req, res) => {
      try {
        const server = getServer(req, res);
        const reserveData = await server.getAaveReserveData(req.body);
        res.json(reserveData);
      } catch (err) {
        returnError(err, res, req);
      }
    });

    router.post('/v1/service/aave/reserveTokensAddresses', async (req, res) => {
      try {
        const server = getServer(req, res);
        const tokensAddresses = await server.getAaveReserveTokensAddresses(req.body);
        res.json(tokensAddresses);
      } catch (err) {
        returnError(err, res, req);
      }
    });

    this.router = router;
  }
}
