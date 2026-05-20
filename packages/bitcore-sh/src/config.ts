import fs from 'fs';
import { homedir } from 'os';
import path from 'path';

interface ConfigType {
  [chain: string]: {
    [network: string]: {
      host: string;
      port: number | string;
      username: string;
      password: string;
      protocol?: 'http' | 'https' | 'ws' | 'wss' | 'ipc';
    };
  };
};

const args = process.argv.slice(2);
const DEFAULT_CONFIG = path.join(__dirname, '../../../../bitcore.config.json');
let bitcoreConfigPath: string;

const pathIndex = args.indexOf('--path');
if (pathIndex !== -1) {
  bitcoreConfigPath = args[pathIndex + 1];
} else {
  bitcoreConfigPath = process.env.BITCORE_CONFIG_PATH || DEFAULT_CONFIG
}

if (bitcoreConfigPath[0] === '~') {
  bitcoreConfigPath = bitcoreConfigPath.replace('~', homedir());
}

if (!fs.existsSync(bitcoreConfigPath)) {
  throw new Error(`No bitcore config exists at ${bitcoreConfigPath}`);
}

const bitcoreConfigStat = fs.statSync(bitcoreConfigPath);

if (bitcoreConfigStat.isDirectory()) {
  if (!fs.existsSync(path.join(bitcoreConfigPath, 'bitcore.config.json'))) {
    throw new Error(`No bitcore config exists in directory ${bitcoreConfigPath}`);
  }
  bitcoreConfigPath = path.join(bitcoreConfigPath, 'bitcore.config.json');
}

let rawBitcoreConfig;
try {
  rawBitcoreConfig = fs.readFileSync(bitcoreConfigPath).toString();
} catch (error) {
  throw new Error(`Error in loading bitcore config\nFound file at ${bitcoreConfigPath}\n${error}`);
}

let bitcoreConfig: object;
try {
  bitcoreConfig = JSON.parse(rawBitcoreConfig).bitcoreNode.chains;
} catch (error) {
  throw new Error(`Error in parsing bitcore config\nFound and loaded file at ${bitcoreConfigPath}\n${error}`);
}

const config: ConfigType = {};
for (const chain in bitcoreConfig) {
  const chainConfig = bitcoreConfig[chain];
  config[chain] = {};
  for (const network in chainConfig) {
    const networkConfig = chainConfig[network];
    const rpcConfig = networkConfig.rpc || networkConfig.provider || networkConfig.providers[0];
    config[chain][network] = rpcConfig;
  }
}

export default config;
