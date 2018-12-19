import logger from '../logger';
import * as express from 'express';

type TimedRequest = {
  startTime?: Date;
} & express.Request;

export function LogRequest(req: TimedRequest, res: express.Response, next: express.NextFunction) {
  req.startTime = new Date();
  res.on('finish', () => {
    const endTime = new Date();
    const startTime = req.startTime ? req.startTime : endTime;
    const totalTime = endTime.getTime() - startTime.getTime();
    const totalTimeMsg = `${totalTime} ms`.padStart(10, ' ');
    logger.info(`${startTime.toTimeString()} | ${totalTimeMsg} | ${req.method} | ${req.baseUrl}${req.url}`);
  });
  next();
}

export function SetCache(res: express.Response, serverSeconds: number, browserSeconds: number) {
  res.setHeader('Cache-Control', `s-maxage=${serverSeconds}, max-age=${browserSeconds}`);
}

export function CacheMiddleware(serverSeconds: number, browserSeconds = 5) {
  return (_: express.Request, res: express.Response, next: express.NextFunction) => {
    SetCache(res, serverSeconds, browserSeconds);
    next();
  };
}
