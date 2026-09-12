import 'source-map-support/register.js';
import { createRequire } from 'module';
import Ledger from '../../src/ledger/wallet.js';

const require = createRequire(import.meta.url);
const { deviceControllerClientFactory } = require('@ledgerhq/speculos-device-controller');

const deviceClient = deviceControllerClientFactory('http://localhost:5000');

const deviceButtons = deviceClient.buttonFactory();

await deviceButtons.right();

const ledger = new Ledger();
await ledger.connect();

console.log('Currently actions crash speculos...');
// console.log(await ledger.getVersion());
await ledger.disconnect();
process.exit(0);
