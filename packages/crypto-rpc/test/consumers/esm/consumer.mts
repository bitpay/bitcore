// An ES module consumer on nodenext resolution, the shape a modern package or app would have
import { CryptoRpc, utils } from '@bitpay-labs/crypto-rpc';
import { CryptoRpc as CryptoRpcViaIndex } from '@bitpay-labs/crypto-rpc/index.js';
import { SOL_ERROR_MESSAGES } from '@bitpay-labs/crypto-rpc/lib/sol/error_messages';
import { parseInstructions } from '@bitpay-labs/crypto-rpc/lib/sol/transaction-parser.js';
import { XrpRpc } from '@bitpay-labs/crypto-rpc/lib/xrp/XrpRpc';
import type { CryptoRpcConfig } from '@bitpay-labs/crypto-rpc';
import type { EthRpc } from '@bitpay-labs/crypto-rpc/lib/eth/EthRpc.js';
import type { SolRpc } from '@bitpay-labs/crypto-rpc/lib/sol/SolRpc';

const config: CryptoRpcConfig = { chain: 'BTC', host: '127.0.0.1', protocol: 'http', port: 8332 };
const rpc = new CryptoRpc(config);
const chain: string = rpc.chain;
// @ts-expect-error chain is a string; this directive itself errors if the types ever collapse to any
const notANumber: number = rpc.chain;
const message: string = SOL_ERROR_MESSAGES.SOL_ACCT_NOT_FOUND;
const grouped = parseInstructions([]);
const xrp: XrpRpc = new XrpRpc({ chain: 'XRP', host: '127.0.0.1', protocol: 'ws', port: 6006 });
let sol: SolRpc | undefined;
let eth: EthRpc | undefined;

const viaIndex: typeof CryptoRpc = CryptoRpcViaIndex;

void [chain, notANumber, message, grouped, xrp, sol, eth, utils.toBI, viaIndex];
