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


export type DMKConfig = Partial<{ transport: 'node' | 'speculos'; logger: boolean; apiPort: number }>;
export const getDmk = (params?: DMKConfig) => {
  const { transport = 'node', logger = process.argv.includes('--debug'), apiPort = 5000 } = params || {};
  
  let dmkBuilder = new DeviceManagementKitBuilder();
  switch (transport) {
    case 'speculos':
      dmkBuilder = dmkBuilder.addTransport(speculosTransportFactory('http://localhost:' + apiPort));
      break;
    default:
    case 'node':
      dmkBuilder = dmkBuilder.addTransport(nodeHidTransportFactory);
      break;
  }
  
  if (logger) {
    dmkBuilder = dmkBuilder.addLogger(new ConsoleLogger());
  }
  
  return dmkBuilder.build();
};
