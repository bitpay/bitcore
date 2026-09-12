import { createRequire } from 'module';
import { nodeHidTransportFactory } from '@ledgerhq/device-transport-kit-node-hid';
import type * as DMK from '@ledgerhq/device-management-kit';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const {
  DeviceManagementKitBuilder,
  ConsoleLogger
}: typeof DMK = require('@ledgerhq/device-management-kit');
const { speculosTransportFactory } = require('@ledgerhq/device-transport-kit-speculos');

const ENV = process.env;

let dmkBuilder = new DeviceManagementKitBuilder();

switch ((ENV.BITCORE_HARDWARE_LEDGER_TRANSPORT ?? '').toLowerCase()) {
  case 'speculos':
  case 'test':
    dmkBuilder = dmkBuilder.addTransport(speculosTransportFactory());
    break;
  default:
  case 'node':
    dmkBuilder = dmkBuilder.addTransport(nodeHidTransportFactory);
    break;
}

if ((ENV.BITCORE_HARDWARE_LEDGER_LOGGER ?? '').toLowerCase() === 'true') {
  dmkBuilder = dmkBuilder.addLogger(new ConsoleLogger());
}

export const dmk = dmkBuilder.build();
