import express from 'express';
import _ from 'lodash';
import { formatTimestamp, logger } from './logger';

type TimedRequest = {
  startTime?: Date;
  walletId?: string;
  isSupportStaff?: boolean;
} & express.Request;

function LogObj(logOut: { [key: string]: string }) {
  logger.info(
    `${logOut.support}${logOut.time} | ${logOut.ip} | ${logOut.userAgent || 'na'}  |  ${logOut.walletId || '-'}  | ${
      logOut.phase
    } | ${logOut.took} | ${logOut.method} | ${logOut.status} | ${logOut.url} | ${logOut.openConnections} open`
  );
}

let openConnections = 0;

function LogPhase(req: TimedRequest, res: express.Response, phase: string) {
  const ip = req.header('CF-Connecting-IP') || req.socket.remoteAddress || req.hostname;
  const time = req.startTime ? req.startTime : new Date();
  const ua = req.headers['user-agent'] || '-';
  const ver = req.headers['x-client-version'] || '-';
  const support = req.isSupportStaff ? 'SUPPORT:' : '';
  const logOut = {
    support,
    time: formatTimestamp(time),
    walletId: req.walletId,
    userAgent: ua + ':' + ver,
    ip: _.padStart(ip, 22, ' '),
    phase: _.padStart(phase, 8, ' '),
    method: _.padStart(req.method, 6, ' '),
    status: _.padStart('...', 5, ' '),
    url: `${req.baseUrl}${req.url}`,
    took: _.padStart('...', 10, ' '),
    openConnections: _.padStart(openConnections.toString(), 6, ' ')
  };
  if (req.startTime && ['END', 'CLOSED'].includes(phase)) {
    const endTime = new Date();
    const startTime = req.startTime ? req.startTime : endTime;
    const totalTime = endTime.getTime() - startTime.getTime();
    const totalTimeMsg = `${totalTime} ms`.padStart(10, ' ');
    logOut.took = _.padStart(totalTimeMsg, 10, ' ');
    logOut.status = _.padStart(res.statusCode.toString(), 5, ' ');
  }
  LogObj(logOut);
}
export function LogMiddleware() {
  return (req: TimedRequest, res: express.Response, next: express.NextFunction) => {
    req.startTime = new Date();
    openConnections++;
    // LogPhase(req, res, 'START');
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
