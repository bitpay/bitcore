import { BaseParams } from './types/paramTypes.js';

export interface Base {
  connect(): void;
  sign(params: any): Promise<any>;
  getPublicKey(params: BaseParams): Promise<any>;
  getAddress(params: BaseParams): Promise<any>;
  getVersion(params?: BaseParams): Promise<any>;
};
