import express from 'express';
import { ClientError } from '../../errors/clienterror';
import logger from '../../logger';

export class ApiErrorHelper {
  disableLogs: boolean;

  setOpts(opts: { disableLogs?: boolean }) {
    this.disableLogs = opts.disableLogs ?? this.disableLogs;
    return this;
  }

  returnError(err: any, res: express.Response, req: express.Request): void {
    // make sure headers have not been sent as this leads to an uncaught error
    if (res.headersSent) {
      return;
    }
    if (err instanceof ClientError) {
      const status = err.code == 'NOT_AUTHORIZED' ? 401 : 400;
      if (!this.disableLogs) logger.info('Client Err: ' + status + ' ' + req.url + ' ' + JSON.stringify(err));

      const clientError: { code: string; message: string; messageData?: object } = {
        code: err.code,
        message: err.message
      };
      if (err.messageData) clientError.messageData = err.messageData;
      res
        .status(status)
        .json(clientError)
        .end();
    } else {
      let code = 500;
      let message;
      if (typeof err?.code === 'number' || typeof err?.statusCode === 'number') {
        code = err.code || err.statusCode;
        message = err.message || err.body;
      }

      const m = message || err.toString();

      if (!this.disableLogs) logger.error(req.url + ' :' + code + ':' + m);

      res
        .status(code || 500)
        .json({ error: m })
        .end();
    }
  }
};

export const error = new ApiErrorHelper();