import { createRequire } from 'module';
import { nodeHidTransportFactory } from '@ledgerhq/device-transport-kit-node-hid';
import type * as DMK from '@ledgerhq/device-management-kit';
// @eslint disable import/newline-after-import
const require = createRequire(import.meta.url);
const {
  DeviceManagementKitBuilder
}: typeof DMK = require('@ledgerhq/device-management-kit');


export const dmk = new DeviceManagementKitBuilder()
  .addTransport(nodeHidTransportFactory)
  .build();
