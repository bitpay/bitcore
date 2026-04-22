import * as async from 'async';
import express from 'express';
import * as _ from 'lodash';
import { Common } from '../common';
import { ClientError } from '../errors/clienterror';
import logger from '../logger';
import { WalletService } from '../server';
import type * as Types from '../../types/expressapp';

const { Utils } = Common;

interface RouteContext {
  createWalletLimiter: Types.CreateWalletLimiterFn;
  getServer: Types.GetServerFn;
  getServerWithAuth: Types.GetServerWithAuthFn;
  getServerWithMultiAuth: Types.GetServerWithMultiAuthFn;
  logDeprecated: Types.LogDeprecatedFn;
  returnError: Types.ReturnErrorFn;
}

function getServerOrReturnError(req, res, context: RouteContext): WalletService | null {
  try {
    return context.getServer(req, res);
  } catch (err) {
    context.returnError(err, res, req);
    return null;
  }
}

export function registerWalletRoutes(router: express.Router, context: RouteContext) {
  const { createWalletLimiter, getServerWithAuth, getServerWithMultiAuth, logDeprecated, returnError } = context;

  router.post('/v1/wallets/', createWalletLimiter, (req, res) => {
    logDeprecated(req);
    return returnError(new ClientError('BIP45 wallet creation no longer supported'), res, req);
  });

  router.post('/v2/wallets/', createWalletLimiter, (req, res) => {
    const server = getServerOrReturnError(req, res, context);
    if (!server) return;

    server.createWallet(req.body, (err, walletId) => {
      if (err) return returnError(err, res, req);
      res.json({ walletId });
    });
  });

  router.put('/v1/copayers/:id/', (req, res) => {
    req.body.copayerId = req.params['id'];
    const server = getServerOrReturnError(req, res, context);
    if (!server) return;

    server.addAccess(req.body, (err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.post('/v1/wallets/:id/copayers/', (req, res) => {
    logDeprecated(req);
    return returnError(new ClientError('BIP45 wallet creation no longer supported'), res, req);
  });

  router.post('/v2/wallets/:id/copayers/', (req, res) => {
    req.body.walletId = req.params['id'];
    const server = getServerOrReturnError(req, res, context);
    if (!server) return;

    server.joinWallet(req.body, (err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.get('/v1/wallets/', (req, res) => {
    logDeprecated(req);
    getServerWithAuth(req, res, server => {
      server.getStatus({ includeExtendedInfo: true }, (err, status) => {
        if (err) return returnError(err, res, req);
        res.json(status);
      });
    });
  });

  router.get('/v2/wallets/', (req, res) => {
    getServerWithAuth(req, res, server => {
      const opts = { includeExtendedInfo: false, twoStep: false };
      if (req.query.includeExtendedInfo == '1') opts.includeExtendedInfo = true;
      if (req.query.twoStep == '1') opts.twoStep = true;

      server.getStatus(opts, (err, status) => {
        if (err) return returnError(err, res, req);
        res.json(status);
      });
    });
  });

  router.get('/v3/wallets/', (req, res) => {
    getServerWithAuth(req, res, server => {
      const opts = {
        includeExtendedInfo: false,
        twoStep: false,
        includeServerMessages: false,
        tokenAddress: req.query.tokenAddress,
        multisigContractAddress: req.query.multisigContractAddress,
        network: req.query.network
      };
      if (req.query.includeExtendedInfo == '1') opts.includeExtendedInfo = true;
      if (req.query.twoStep == '1') opts.twoStep = true;
      if (req.query.serverMessageArray == '1') opts.includeServerMessages = true;

      server.getStatus(opts, (err, status) => {
        if (err) return returnError(err, res, req);
        res.json(status);
      });
    });
  });

  router.get('/v1/wallets/all/', async (req, res) => {
    let responses;
    const includeExtendedInfo = req.query.includeExtendedInfo == '1';
    const twoStep = req.query.twoStep == '1';
    const silentFailure = req.query.silentFailure == '1';
    const includeServerMessages = req.query.serverMessageArray == '1';

    const buildOpts = (request, copayerId) => {
      const getParam = (param, returnArray = false) => {
        const value = request.query[`${copayerId}:${param}`] || request.query[copayerId]?.[param];
        if (returnArray) {
          return Array.isArray(value) ? value : value ? [value] : null;
        }
        return value ? value : null;
      };

      return {
        includeExtendedInfo,
        twoStep,
        silentFailure,
        includeServerMessages,
        tokenAddresses: getParam('tokenAddress', true) as string[] | null,
        multisigContractAddress: getParam('multisigContractAddress') as string | null,
        network: getParam('network') as string | null
      };
    };

    try {
      responses = await Promise.all(
        getServerWithMultiAuth(req, res, { silentFailure }).map(promise =>
          promise
            .then(
              (server: WalletService) =>
                new Promise(resolve => {
                  const options = buildOpts(req, server.copayerId);
                  if (options.tokenAddresses) {
                    options.tokenAddresses.unshift(null);
                    return async.concat(
                      options.tokenAddresses,
                      (tokenAddress, cb) => {
                        const optsClone = JSON.parse(JSON.stringify(options));
                        optsClone.tokenAddresses = null;
                        optsClone.tokenAddress = tokenAddress;
                        return server.getStatus(optsClone, (err, status) => {
                          const result = {
                            walletId: server.walletId,
                            tokenAddress: optsClone.tokenAddress,
                            success: true,
                            ...(err ? { success: false, message: err.message } : {}),
                            status
                          };
                          if (err && err.message) {
                            logger.error(
                              `An error occurred retrieving wallet status - id: ${server.walletId} - token address: ${optsClone.tokenAddress} - err: ${err.message}`
                            );
                          }
                          cb(null, [result]);
                        });
                      },
                      (_err, result) => resolve(result)
                    );
                  }

                  return server.getStatus(options, (err, status) => {
                    return resolve([
                      {
                        walletId: server.walletId,
                        tokenAddress: null,
                        success: true,
                        ...(err ? { success: false, message: err.message } : {}),
                        status
                      }
                    ]);
                  });
                }),
              ({ message }) => Promise.resolve({ success: false, error: message })
            )
            .catch(err => {
              if (!silentFailure) {
                returnError(err, res, req);
              }
            })
        )
      );
    } catch (err) {
      return returnError(err, res, req);
    }

    return res.json(_.flatten(responses));
  });

  router.post('/v1/wallets/exist', async (req, res) => {
    try {
      const copayers = req.body.copayers;
      if (!copayers || !Array.isArray(copayers)) {
        logger.info('Invalid request to /v1/wallets/exist - copayers should be an array');
        return res.json([]);
      }

      const storage = WalletService.getStorage();
      const existing = await Promise.all<{ copayerId: string; verified: boolean }>(copayers.map(c => new Promise((resolve) => {
        storage.fetchCopayerLookup(c.copayerId, (err, copayer) => {
          if (err || !copayer) {
            return resolve({ copayerId: c.copayerId, verified: false });
          }
          const verified = copayer.requestPubKeys.some(pubkey => Utils.verifyMessage(c.copayerId, c.signature, pubkey.key));
          return resolve({ copayerId: c.copayerId, verified });
        });
      })));
      return res.json(existing.filter(e => e.verified).map(e => e.copayerId));
    } catch (err) {
      return returnError(err, res, req);
    }
  });

  router.get('/v1/wallets/:identifier/', (req, res) => {
    getServerWithAuth(
      req,
      res,
      {
        onlySupportStaff: true
      },
      server => {
        const opts = {
          identifier: req.params['identifier'],
          walletCheck: ['1', 'true'].includes(req.query['walletCheck'])
        };

        server.getWalletFromIdentifier(opts, (err, wallet) => {
          if (err) return returnError(err, res, req);
          if (!wallet) return res.end();

          server.walletId = wallet.id;
          const statusOpts = { includeExtendedInfo: false };
          if (req.query.includeExtendedInfo == '1') statusOpts.includeExtendedInfo = true;

          server.getStatus(statusOpts, (statusErr, status) => {
            if (statusErr) return returnError(statusErr, res, req);
            res.json(status);
          });
        });
      }
    );
  });

  router.get('/v1/preferences/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.getPreferences({}, (err, preferences) => {
        if (err) return returnError(err, res, req);
        res.json(preferences);
      });
    });
  });

  router.put('/v1/preferences', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.savePreferences(req.body, (err, result) => {
        if (err) return returnError(err, res, req);
        res.json(result);
      });
    });
  });
}
