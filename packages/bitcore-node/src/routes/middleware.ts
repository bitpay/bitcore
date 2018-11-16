import logger from '../logger';
import * as express from 'express';
export function LogRequest(req: express.Request, _: express.Response, next: express.NextFunction) {
  logger.info(req.baseUrl + req.url);
  next();
}
