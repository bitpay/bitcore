import express from 'express';
import * as Types from '../../types/expressapp';

interface AaveRouterOpts {
  returnError: Types.ReturnErrorFn;
  getServerWithAuth: Types.GetServerWithAuthFn;
}

export class AaveRouter {
  router: express.Router;

  constructor(params: AaveRouterOpts) {
    const { returnError, getServerWithAuth } = params;
    const router = express.Router();

    router.post('/v1/service/aave/userAccountData', (req, res) => {
      getServerWithAuth(req, res, async server => {
        try {
          const accountData = await server.getAaveUserAccountData(req.body);
          res.json(accountData);
        } catch (err) {
          returnError(err, res, req);
        }
      });
    });

    router.post('/v1/service/aave/reserveData', (req, res) => {
      getServerWithAuth(req, res, async server => {
        try {
          const reserveData = await server.getAaveReserveData(req.body);
          res.json(reserveData);
        } catch (err) {
          returnError(err, res, req);
        }
      });
    });

    router.post('/v1/service/aave/reserveTokensAddresses', (req, res) => {
      getServerWithAuth(req, res, async server => {
        try {
          const tokensAddresses = await server.getAaveReserveTokensAddresses(req.body);
          res.json(tokensAddresses);
        } catch (err) {
          returnError(err, res, req);
        }
      });
    });

    this.router = router;
  }
}
