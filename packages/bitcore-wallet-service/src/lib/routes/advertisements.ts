import express from 'express';
import type * as Types from '../../types/expressapp';

interface RouteContext {
  getServer: Types.GetServerFn;
  getServerWithAuth: Types.GetServerWithAuthFn;
  setPublicCache: (res: express.Response, seconds: number) => void;
  returnError: Types.ReturnErrorFn;
}

export function registerAdvertisementRoutes(router: express.Router, context: RouteContext) {
  const { getServer, getServerWithAuth, setPublicCache, returnError } = context;
  const ONE_MINUTE = 60;

  router.post('/v1/advertisements/', (req, res) => {
    getServerWithAuth(
      req,
      res,
      {
        onlyMarketingStaff: true
      },
      server => {
        server.createAdvert(req.body, (err, advert) => {
          if (err) {
            return returnError(err, res, req);
          }
          if (advert) res.json(advert);
        });
      }
    );
  });

  router.get('/v1/advertisements/', (req, res) => {
    const testing = req.query.testing;

    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }

    if (testing) {
      server.getTestingAdverts(req.body, (err, ads) => {
        if (err) return returnError(err, res, req);
        res.json(ads);
      });
      return;
    }

    setPublicCache(res, 5 * ONE_MINUTE);
    server.getAdverts(req.body, (err, ads) => {
      if (err) return returnError(err, res, req);
      res.json(ads);
    });
  });

  router.get('/v1/advertisements/:adId/', (req, res) => {
    let server;

    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }

    const opts = { adId: req.params['adId'] };

    if (req.params['adId']) {
      server.getAdvert(opts, (err, ad) => {
        if (err) return returnError(err, res, req);
        res.json(ad);
      });
    }
  });

  router.get('/v1/advertisements/country/:country', (req, res) => {
    const opts = { country: req.params['country'] };

    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }

    server.getAdvertsByCountry(opts, (err, ads) => {
      if (err) return returnError(err, res, req);
      res.json(ads);
    });
  });

  router.post('/v1/advertisements/:adId/activate', (req, res) => {
    const opts = { adId: req.params['adId'] };

    getServerWithAuth(
      req,
      res,
      {
        onlyMarketingStaff: true
      },
      server => {
        if (req.params['adId']) {
          server.activateAdvert(opts, err => {
            if (err) return returnError(err, res, req);
            res.json({ advertisementId: opts.adId, message: 'advert activated' });
          });
        }
      }
    );
  });

  router.post('/v1/advertisements/:adId/deactivate', (req, res) => {
    const opts = { adId: req.params['adId'] };

    getServerWithAuth(
      req,
      res,
      {
        onlyMarketingStaff: true
      },
      server => {
        if (req.params['adId']) {
          server.deactivateAdvert(opts, err => {
            if (err) return returnError(err, res, req);
            res.json({ advertisementId: opts.adId, message: 'advert deactivated' });
          });
        }
      }
    );
  });

  router.delete('/v1/advertisements/:adId/', (req, res) => {
    getServerWithAuth(
      req,
      res,
      {
        onlyMarketingStaff: true
      },
      server => {
        req.body.adId = req.params['adId'];
        server.removeAdvert(req.body, (err, removedAd) => {
          if (err) return returnError(err, res, req);
          if (removedAd) {
            res.json(removedAd);
          }
        });
      }
    );
  });
}
