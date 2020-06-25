import express from 'express';
import { logger, formatTimestamp } from './logger';

type TimedRequest = {
  startTime?: Date;
  walletId?: string;
} & express.Request;

function LogObj(logOut: { [key: string]: string }) {
  logger.info(
    `${logOut.time} |  ${logOut.walletId} | ${logOut.ip} | ${logOut.phase} | ${logOut.took} | ${logOut.method} | ${logOut.status} | ${logOut.url} | ${logOut.openConnections} open`
  );
}

let openConnections = 0;

function LogPhase(req: TimedRequest, res: express.Response, phase: string) {
  const ip = req.header('CF-Connecting-IP') || req.socket.remoteAddress || req.hostname;
  const time = req.startTime ? req.startTime : new Date();
  const logOut = {
    time: formatTimestamp(time),
    walletId: req.walletId,
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
    //LogPhase(req, res, 'START');
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


