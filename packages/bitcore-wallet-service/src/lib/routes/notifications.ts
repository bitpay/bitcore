import express from 'express';
import { Common } from '../common';
import type * as Types from '../../types/expressapp';

const { Defaults } = Common;

interface RouteContext {
  getServerWithAuth: Types.GetServerWithAuthFn;
  logDeprecated: Types.LogDeprecatedFn;
  returnError: Types.ReturnErrorFn;
}

export function registerNotificationRoutes(router: express.Router, context: RouteContext) {
  const { getServerWithAuth, logDeprecated, returnError } = context;

  router.post('/v1/login/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.login({}, (err, session) => {
        if (err) return returnError(err, res, req);
        res.json(session);
      });
    });
  });

  router.post('/v1/logout/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.logout({}, err => {
        if (err) return returnError(err, res, req);
        res.end();
      });
    });
  });

  router.get('/v1/notifications/', (req, res) => {
    getServerWithAuth(
      req,
      res,
      {
        allowSession: true
      },
      server => {
        const timeSpan = req.query.timeSpan
          ? Math.min(+req.query.timeSpan || 0, Defaults.MAX_NOTIFICATIONS_TIMESPAN)
          : Defaults.NOTIFICATIONS_TIMESPAN;
        const opts = {
          minTs: +Date.now() - timeSpan * 1000,
          notificationId: req.query.notificationId
        };

        server.getNotifications(opts, (err, notifications) => {
          if (err) return returnError(err, res, req);
          res.json(notifications);
        });
      }
    );
  });

  router.post('/v1/pushnotifications/subscriptions/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.pushNotificationsSubscribe(req.body, (err, response) => {
        if (err) return returnError(err, res, req);
        res.json(response);
      });
    });
  });

  router.post('/v2/pushnotifications/subscriptions/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.pushNotificationsBrazeSubscribe(req.body, (err, response) => {
        if (err) return returnError(err, res, req);
        res.json(response);
      });
    });
  });

  router.delete('/v1/pushnotifications/subscriptions/', (req, res) => {
    logDeprecated(req);
    getServerWithAuth(req, res, server => {
      server.pushNotificationsUnsubscribe(
        {
          token: 'dummy'
        },
        (err, response) => {
          if (err) return returnError(err, res, req);
          res.json(response);
        }
      );
    });
  });

  router.delete('/v2/pushnotifications/subscriptions/:token', (req, res) => {
    const opts = {
      token: req.params['token']
    };
    getServerWithAuth(req, res, server => {
      server.pushNotificationsUnsubscribe(opts, (err, response) => {
        if (err) return returnError(err, res, req);
        res.json(response);
      });
    });
  });

  router.delete('/v3/pushnotifications/subscriptions/:externalUserId', (req, res) => {
    const opts = {
      externalUserId: req.params['externalUserId']
    };
    getServerWithAuth(req, res, server => {
      server.pushNotificationsBrazeUnsubscribe(opts, (err, response) => {
        if (err) return returnError(err, res, req);
        res.json(response);
      });
    });
  });

  router.post('/v1/txconfirmations/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.txConfirmationSubscribe(req.body, (err, response) => {
        if (err) return returnError(err, res, req);
        res.json(response);
      });
    });
  });

  router.delete('/v1/txconfirmations/:txid', (req, res) => {
    const opts = {
      txid: req.params['txid']
    };
    getServerWithAuth(req, res, server => {
      server.txConfirmationUnsubscribe(opts, (err, response) => {
        if (err) return returnError(err, res, req);
        res.json(response);
      });
    });
  });
}
