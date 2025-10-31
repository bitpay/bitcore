/**
 * The official client library for bitcore-wallet-service
 */

/**
 * Client API
 */
import { API } from './lib/api';
export default API;

export { API, Network, CreateWalletOpts, Status, Txp } from './lib/api';
export { Credentials } from './lib/credentials';
export { PayProV2 } from './lib/payproV2';
export { PayPro } from './lib/paypro';
export { Key } from './lib/key';
export { Verifier } from './lib/verifier';
export { Encryption } from './lib/common/encryption';
export type * as EncryptionTypes from './lib/common/encryption';
export { Utils } from './lib/common/utils';
export type * as UtilsTypes from './lib/common/utils';
export { Errors } from './lib/errors';

export * as TssKey from './lib/tsskey';
export * as TssSign from './lib/tsssign';