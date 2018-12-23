import logger from '../logger';
import * as express from 'express';
import { RateLimitModel } from '../models/rateLimit';
import config from '../config';

type TimedRequest = {
  startTime?: Date;
} & express.Request;

function LogObj(logOut: { [key: string]: string }) {
  logger.info(
    `${logOut.time} | ${logOut.ip} | ${logOut.phase} | ${logOut.took} | ${logOut.method} | ${logOut.status} | ${
      logOut.url
    }`
  );
}

export function LogRequest(req: TimedRequest, res: express.Response, next: express.NextFunction) {
  req.startTime = new Date();
  const ip = req.header('CF-Connecting-IP') || req.socket.remoteAddress || req.hostname;
  const logOut = {
    time: req.startTime.toTimeString(),
    ip: ip.padStart(12, ' '),
    phase: 'START'.padStart(8, ' '),
    method: req.method.padStart(6, ' '),
    status: '...'.padStart(5, ' '),
    url: `${req.baseUrl}${req.url}`,
    took: '...'.padStart(10, ' ')
  };
  LogObj(logOut);

  const LogPhase = (phase: string) => () => {
    const endTime = new Date();
    const startTime = req.startTime ? req.startTime : endTime;
    const totalTime = endTime.getTime() - startTime.getTime();
    const totalTimeMsg = `${totalTime} ms`;
    logOut.phase = phase.padStart(8, ' ');
    logOut.took = totalTimeMsg.padStart(10, ' ');
    logOut.status = res.statusCode.toString().padStart(5, ' ');
    LogObj(logOut);
  };

  res.on('finish', LogPhase('END'));
  res.on('close', LogPhase('CLOSED'));
  next();
}

export function RateLimiter(method: string, perSecond: number, perMinute: number, perHour: number) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const identifier = req.header('CF-Connecting-IP') || req.socket.remoteAddress || '';
      if (config.api.rateLimiter.whitelist.includes(identifier)) {
        return next();
      }
      let [perSecondResult, perMinuteResult, perHourResult] = await RateLimitModel.incrementAndCheck(identifier, method);
      if (
        (perSecondResult.value as any).count > perSecond ||
        (perMinuteResult.value as any).count > perMinute ||
        (perHourResult.value as any).count > perHour) {
        return res.status(429).send('Rate Limited');
      }
    } catch (err) {
      logger.error('Rate Limiter failed');
    }
    return next();
  }
}
