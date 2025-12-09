import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import hardhat from 'hardhat';

const require = createRequire(import.meta.url);

const sequential = process.env.HH_SEQUENTIAL_DEPLOY == '1' || hardhat.network.config['sequentialDeploy'];
if (sequential) {
  console.log('Sequential deployment enabled');
}

export default buildModule('Deploy_All', (m) => {
  const mods = fs.readdirSync(import.meta.dirname);
  let prev;
  for (const mod of mods) {
    if (mod === path.basename(import.meta.filename)) {
      continue;
    }
    console.log('Using module:', mod);
    const module = require(`${import.meta.dirname}/${mod}`);
    const contracts = m.useModule(module.default);
    if (sequential) { // sequentially deploy the contracts instead of in parallel
      if (prev) {
        for (const contract of Object.values(contracts)) {
          contract.dependencies.add(prev);
        }
      }
      prev = Object.values(contracts)[0];
    }
  }
});
