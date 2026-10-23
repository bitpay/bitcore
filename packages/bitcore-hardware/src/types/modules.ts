/**
 * Anything with signing functionality.
 * Could be a class that only signs for one chain.
 */
export interface Module {
  sign(params: any): Promise<string>;
  getPublicKey(params: any): Promise<string>;
  getAddress(params: any): Promise<string>;
};

/**
 * Anything with signing functionality for one or many devices.
 * Contains all functionality for its device(s).
 */
export interface Hardware extends Module {
  connect(): Promise<any>;
  disconnect(): Promise<any>;
};
