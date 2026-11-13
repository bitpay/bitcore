// A bitcore-node style consumer: CommonJS output with the classic node10 resolution, so the
// deep paths are found through typesVersions rather than the exports map
import { CryptoRpc, utils } from '@bitpay-labs/crypto-rpc';
import type { CryptoRpcConfig } from '@bitpay-labs/crypto-rpc';
import { SOL_ERROR_MESSAGES } from '@bitpay-labs/crypto-rpc/lib/sol/error_messages';
import { parseInstructions } from '@bitpay-labs/crypto-rpc/lib/sol/transaction-parser';
import type { SolRpc } from '@bitpay-labs/crypto-rpc/lib/sol/SolRpc';
import type { EthRpc } from '@bitpay-labs/crypto-rpc/lib/eth/EthRpc';
import { XrpRpc } from '@bitpay-labs/crypto-rpc/lib/xrp/XrpRpc';

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

void [chain, notANumber, message, grouped, xrp, sol, eth, utils.toBI];
