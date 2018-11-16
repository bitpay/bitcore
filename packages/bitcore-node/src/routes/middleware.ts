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
    const totalTimeMsg = `${totalTime} ms`.padStart(10, ' ');;
    logger.info(`${startTime.toTimeString()} | ${totalTimeMsg} | ${req.method} | ${req.baseUrl}${req.url}`);
  });
  next();
}
