import * as express from 'express';
import logger from '../logger';
import { RateLimitStorage } from '../models/rateLimit';
import { Config } from '../services/config';

type TimedRequest = {
  startTime?: Date;
} & express.Request;

function LogObj(logOut: { [key: string]: string }) {
  logger.info(
    `${logOut.time} | ${logOut.ip} | ${logOut.phase} | ${logOut.took} | ${logOut.method} | ${logOut.status} | ${logOut.url} | ${logOut.openConnections} open`
  );
}

let openConnections = 0;

function LogPhase(req: TimedRequest, res: express.Response, phase: string) {
  const ip = req.header('CF-Connecting-IP') || req.socket.remoteAddress || req.hostname;
  const logOut = {
    time: req.startTime ? req.startTime.toTimeString() : new Date().toTimeString(),
    ip: ip.padStart(22, ' '),
    phase: phase.padStart(8, ' '),
    method: req.method.padStart(6, ' '),
    status: '...'.padStart(5, ' '),
    url: `${req.baseUrl}${req.url}`,
    took: '...'.padStart(10, ' '),
    openConnections: openConnections.toString().padStart(6, ' ')
  };
  if (req.startTime && ['END', 'CLOSED'].includes(phase)) {
    const endTime = new Date();
    const startTime = req.startTime ? req.startTime : endTime;
    const totalTime = endTime.getTime() - startTime.getTime();
    const totalTimeMsg = `${totalTime} ms`.padStart(10, ' ');
    logOut.took = totalTimeMsg.padStart(10, ' ');
    logOut.status = res.statusCode.toString().padStart(5, ' ');
  }
  LogObj(logOut);
}
export function LogMiddleware() {
  return (req: TimedRequest, res: express.Response, next: express.NextFunction) => {
    req.startTime = new Date();
    openConnections++;
    LogPhase(req, res, 'START');
    res.on('finish', () => {
      openConnections--;
      LogPhase(req, res, 'END');
    });
    res.on('close', () => {
      openConnections--;
      LogPhase(req, res, 'CLOSED');
    });
    next();
  };
}

export enum Confirmations {
  None = 0,
  Shallow = 1,
  Deep = 100
}
export enum CacheTimes {
  None = 0,
  Second = 1,
  Minute = 60,
  Hour = CacheTimes.Minute * 60,
  Day = CacheTimes.Hour * 24,
  Month = CacheTimes.Day * 30,
  Year = CacheTimes.Day * 365
}
export function SetCache(res: express.Response, serverSeconds: number, browserSeconds: number = 0) {
  res.setHeader('Cache-Control', `s-maxage=${serverSeconds}, max-age=${browserSeconds}`);
}

export function CacheMiddleware(serverSeconds = CacheTimes.Second, browserSeconds = CacheTimes.None) {
  return (_: express.Request, res: express.Response, next: express.NextFunction) => {
    SetCache(res, serverSeconds, browserSeconds);
    next();
  };
}

function isWhiteListed(whitelist: Array<string> = [], ip: string) {
  return whitelist.some(listItem => ip.startsWith(listItem));
}

export function RateLimiter(method: string, perSecond: number, perMinute: number, perHour: number) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const identifier = req.header('CF-Connecting-IP') || req.socket.remoteAddress || '';
      const rateLimiter = Config.for('api').rateLimiter;
      const whitelist = rateLimiter && rateLimiter.whitelist;
      const isDisabled = rateLimiter && rateLimiter.disabled;
      if (isDisabled || isWhiteListed(whitelist, identifier)) {
        return next();
      }
      let [perSecondResult, perMinuteResult, perHourResult] = await RateLimitStorage.incrementAndCheck(
        identifier,
        method
      );
      if (
        perSecondResult.value!.count > perSecond ||
        perMinuteResult.value!.count > perMinute ||
        perHourResult.value!.count > perHour
      ) {
        return res.status(429).send('Rate Limited');
      }
    } catch (err) {
      logger.error('Rate Limiter failed');
    }
    return next();
  };
}
