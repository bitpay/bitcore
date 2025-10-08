import * as crypto from 'crypto';
import * as request from 'request';
import config from '../config';
import { ClientError } from '../lib/errors/clienterror';
import { Errors } from '../lib/errors/errordefinitions';
import logger from '../lib/logger';
import { checkRequired } from '../lib/server';

export class ChangellyService {
  request: any = request;

  private changellyGetKeysV2(req) {
    if (!config.changelly) {
      logger.warn('Changelly missing credentials');
      throw new Error('ClientError: Service not configured.');
    } else if (!config.changelly.v2) {
      logger.warn('Changelly v2 missing credentials');
      throw new Error('ClientError: Service v2 not configured.');
    }

    const keys = {
      API: config.changelly.v2.api,
      SECRET: config.changelly.v2.secret
    };

    return keys;
  }

  changellySignRequestsV2(message, secret: string) {
    if (!message || !secret) throw new Error('Missing parameters to sign Changelly v2 request');

    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(secret, 'hex'),
      format: 'der',
      type: 'pkcs8',
    });

    const publicKey = crypto.createPublicKey(privateKey).export({
      type: 'pkcs1',
      format: 'der'
    });

    const signature = crypto.sign('sha256', Buffer.from(JSON.stringify(message)), privateKey);

    return { signature, publicKey };
  }

  changellyGetCurrencies(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        return reject(Errors.UPGRADE_NEEDED.withMessage('Credentials expired, please update the app to continue using Changelly services.'));
      }

      if (!checkRequired(req.body, ['id'])) {
        return reject(new ClientError('changellyGetCurrencies request missing arguments'));
      }

      const message = {
        jsonrpc: '2.0',
        id: req.body.id,
        method: req.body.full ? 'getCurrenciesFull' : 'getCurrencies',
        params: {}
      };

      const URL: string = keys.API;
      const { signature, publicKey } = this.changellySignRequestsV2(message, keys.SECRET);
      headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
        'X-Api-Signature': signature.toString('base64'),
      };

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  changellyGetPairsParams(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        return reject(Errors.UPGRADE_NEEDED.withMessage('Credentials expired, please update the app to continue using Changelly services.'));
      }

      if (!checkRequired(req.body, ['id', 'coinFrom', 'coinTo'])) {
        return reject(new ClientError('changellyGetPairsParams request missing arguments'));
      }

      const message = {
        id: req.body.id,
        jsonrpc: '2.0',
        method: 'getPairsParams',
        params: [
          {
            from: req.body.coinFrom,
            to: req.body.coinTo
          }
        ]
      };

      const URL: string = keys.API;
      const { signature, publicKey } = this.changellySignRequestsV2(message, keys.SECRET);
      headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
        'X-Api-Signature': signature.toString('base64'),
      };

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  changellyGetFixRateForAmount(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        return reject(Errors.UPGRADE_NEEDED.withMessage('Credentials expired, please update the app to continue using Changelly services.'));
      }

      if (!checkRequired(req.body, ['id', 'coinFrom', 'coinTo', 'amountFrom'])) {
        return reject(new ClientError('changellyGetFixRateForAmount request missing arguments'));
      }

      const message = {
        id: req.body.id,
        jsonrpc: '2.0',
        method: 'getFixRateForAmount',
        params: [
          {
            from: req.body.coinFrom,
            to: req.body.coinTo,
            amountFrom: req.body.amountFrom
          }
        ]
      };

      const URL: string = keys.API;
      const { signature, publicKey } = this.changellySignRequestsV2(message, keys.SECRET);
      headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
        'X-Api-Signature': signature.toString('base64'),
      };

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  changellyCreateFixTransaction(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        return reject(Errors.UPGRADE_NEEDED.withMessage('Credentials expired, please update the app to continue using Changelly services.'));
      }

      if (
        !checkRequired(req.body, [
          'id',
          'coinFrom',
          'coinTo',
          'amountFrom',
          'addressTo',
          'fixedRateId',
          'refundAddress'
        ])
      ) {
        return reject(new ClientError('changellyCreateFixTransaction request missing arguments'));
      }

      const message = {
        id: req.body.id,
        jsonrpc: '2.0',
        method: 'createFixTransaction',
        params: {
          from: req.body.coinFrom,
          to: req.body.coinTo,
          address: req.body.addressTo,
          amountFrom: req.body.amountFrom,
          rateId: req.body.fixedRateId,
          refundAddress: req.body.refundAddress
        }
      };

      const URL: string = keys.API;
      const { signature, publicKey } = this.changellySignRequestsV2(message, keys.SECRET);
      headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
        'X-Api-Signature': signature.toString('base64'),
      };

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  changellyGetTransactions(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        return reject(Errors.UPGRADE_NEEDED.withMessage('Credentials expired, please update the app to continue using Changelly services.'));
      }

      if (!checkRequired(req.body, ['id', 'exchangeTxId'])) {
        return reject(new ClientError('changellyGetTransactions request missing arguments'));
      }

      const message = {
        id: req.body.id,
        jsonrpc: '2.0',
        method: 'getTransactions',
        params:
        {
          id: req.body.exchangeTxId,
          limit: req.body.limit ?? 1,
        }
      };

      const URL: string = keys.API;
      const { signature, publicKey } = this.changellySignRequestsV2(message, keys.SECRET);
      headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
        'X-Api-Signature': signature.toString('base64'),
      };

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }

  changellyGetStatus(req): Promise<any> {
    return new Promise((resolve, reject) => {
      let keys, headers;
      if (req.body.useV2) {
        keys = this.changellyGetKeysV2(req);
      } else {
        return reject(Errors.UPGRADE_NEEDED.withMessage('Credentials expired, please update the app to continue using Changelly services.'));
      }

      if (!checkRequired(req.body, ['id', 'exchangeTxId'])) {
        return reject(new ClientError('changellyGetStatus request missing arguments'));
      }

      const message = {
        jsonrpc: '2.0',
        id: req.body.id,
        method: 'getStatus',
        params: {
          id: req.body.exchangeTxId
        }
      };

      const URL: string = keys.API;
      const { signature, publicKey } = this.changellySignRequestsV2(message, keys.SECRET);
      headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': crypto.createHash('sha256').update(publicKey).digest('base64'),
        'X-Api-Signature': signature.toString('base64'),
      };

      this.request.post(
        URL,
        {
          headers,
          body: message,
          json: true
        },
        (err, data) => {
          if (err) {
            return reject(err.body ?? err);
          } else {
            return resolve(data.body);
          }
        }
      );
    });
  }
}