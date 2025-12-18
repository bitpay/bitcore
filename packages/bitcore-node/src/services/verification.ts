import { Class } from '../types/Class';
import { BaseP2PWorker } from './p2p';

export interface ErrorType {
  model: string;
  err: boolean;
  type: string;
  payload: any;
}

export interface IVerificationPeer extends BaseP2PWorker<any> {
  connect(): Promise<void>;
  resync(from: number, to: number): Promise<void>;
  getBlockForNumber(blockNum: number): Promise<any>;
  enableDeepScan();
  disableDeepScan();
  validateDataForBlock(
    blockNum: number,
    tipHeight: number,
    log?: boolean
  ): Promise<{ success: boolean; errors: Array<ErrorType> }>;
}

export class VerificationManager {
  workerClasses: { [chain: string]: Class<IVerificationPeer> } = {};

  constructor() {}

  register(chain: string, network: string, worker: Class<IVerificationPeer>) {
    this.workerClasses[chain] = this.workerClasses[chain] || {};
    this.workerClasses[chain][network] = worker;
  }

  get(chain: string, network: string) {
    return this.workerClasses[chain]?.[network];
  }
}

export const Verification = new VerificationManager();
