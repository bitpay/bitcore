import { createRequire } from 'module';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const {
  ConsoleLogger,
  DeviceManagementKitBuilder
} = require('@ledgerhq/device-management-kit');
const { nodeHidTransportFactory } = require('@ledgerhq/device-transport-kit-node-hid');


export const dmk = new DeviceManagementKitBuilder()
  .addLogger(new ConsoleLogger())
  .addTransport(nodeHidTransportFactory)
  .build();
