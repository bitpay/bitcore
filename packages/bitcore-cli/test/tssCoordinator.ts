import { type ChildProcess, spawn } from 'child_process';
import { Transform, type TransformOptions } from 'stream';
import fs from 'fs';
import * as helpers from './helpers';

const { WALLETS } = helpers.CONSTANTS;
const { CLI_EXEC, CLI_OPTS } = WALLETS;

const tssInstances: { [key: string]: ChildProcess } = {};

export type TssTransformOptions = TransformOptions & {
  transform: (
    data: { walletName: string; chunk: Buffer },
    encoding,
    next: (err?: Error | null, data?: string) => void
  ) => void;

}

export class TssTransform extends Transform {
  constructor(opts: TssTransformOptions) {
    super({ encoding: 'utf-8', ...opts });
  }
}

export function startTssWallets(ioHandler: TssTransform, walletNames: string[], walletOptions: string[]) {
  const exitCodes = [];

  for (const walletName of walletNames) {
    if (tssInstances[walletName]) {
      throw new Error(`TSS wallet with name ${walletName} already exists`);
    }
    const walletProcess = spawn('node', [CLI_EXEC, walletName, ...walletOptions], CLI_OPTS);
    walletProcess.stderr.pipe(helpers.filterStderr()).pipe(process.stderr);
    walletProcess.stdout
      .pipe(new Transform({
        encoding: 'utf-8',
        transform(chunk, encoding, next) {
          next(null, JSON.stringify({ walletName, chunk: chunk.toString() }));
        }
      }))
      .pipe(ioHandler) // <== Test case assertion transform stream
      .pipe(new Transform({
        encoding: 'utf-8',
        transform(data, encoding, next) {
          const {
            walletName: destWalletName,
            chunk,
            endIt
          } = JSON.parse(data.toString());
          if (destWalletName === walletName) {
            if (endIt) {
              // send EOF to process so it can exit cleanly
              walletProcess.stdin.end();
            }
            next(null, chunk);
          } else {
            next();
          }
        }
      }))
      .pipe(walletProcess.stdin);
    walletProcess.on('error', (e) => {
      ioHandler.emit('error', e);
    });
    walletProcess.on('close', (code) => {
      delete tssInstances[walletName];
      exitCodes.push(code);
      if (walletNames.every(wn => !Object.keys(tssInstances).includes(wn))) {
        ioHandler.emit('allClosed', exitCodes);
      }
    });
    tssInstances[walletName] = walletProcess;
  }
}
