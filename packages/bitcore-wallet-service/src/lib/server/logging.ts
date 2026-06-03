import { singleton } from 'preconditions';
import logger from '../logger';
import type { WalletService } from '../server';

const $ = singleton();
type BwsLogger = typeof logger;

export function runLocked(service: WalletService, cb, task, waitTime?: number) {
  $.checkState(service.walletId, 'Failed state: this.walletId undefined at <_runLocked()>');
  service.lock.runLocked(service.walletId, { waitTime }, cb, task);
}

export function cleanLogArgs(args) {
  if (!args || args.length === 0) {
    return [];
  }
  if (!Array.isArray(args)) {
    args = [args];
  }
  for (let i = 0; i < args.length; i++) {
    args[i] = args[i]?.response ? JSON.parse(JSON.stringify(args[i])) : args[i];
  }
  return args;
}

export function logInfo(service: WalletService, message: string, ...args: any[]): BwsLogger {
  args = cleanLogArgs(args);

  if (typeof message === 'string' && args.length > 0 && !message.endsWith('%o')) {
    for (let i = 0; i < args.length; i++) {
      message += ' %o';
    }
  }

  if (!service || !service.walletId) {
    return logger.warn(message, ...args);
  }

  message = '<' + service.walletId + '>' + message;
  return logger.info(message, ...args);
}

export function logWarn(service: WalletService, message: string, ...args: any[]): BwsLogger {
  args = cleanLogArgs(args);

  if (typeof message === 'string' && args.length > 0 && !message.endsWith('%o')) {
    for (let i = 0; i < args.length; i++) {
      message += ' %o';
      args[i] = args[i]?.stack || args[i]?.message || args[i];
    }
  }

  if (!service || !service.walletId) {
    return logger.warn(message, ...args);
  }

  message = '<' + service.walletId + '>' + message;
  return logger.warn(message, ...args);
}

export function logDebug(service: WalletService, message: string, ...args: any[]): BwsLogger {
  args = cleanLogArgs(args);

  if (typeof message === 'string' && args.length > 0 && !message.endsWith('%o')) {
    for (let i = 0; i < args.length; i++) {
      message += ' %o';
    }
  }

  if (!service || !service.walletId) {
    return logger.verbose(message, ...args);
  }

  message = '<' + service.walletId + '>' + message;
  return logger.verbose(message, ...args);
}
