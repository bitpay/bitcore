import fs from 'fs';

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

const path: string = process.env.BITCORE_CONFIG_PATH || '';
const rawConfig: object = JSON.parse(fs.readFileSync(path).toString()).bitcoreNode.chains;
const config: ConfigType = {};
for (const chain in rawConfig) {
  const chainConfig = rawConfig[chain];
  config[chain] = {};
  for (const network in chainConfig) {
    const networkConfig = chainConfig[network];
    const rpcConfig = networkConfig.rpc || networkConfig.provider || networkConfig.providers[0];
    config[chain][network] = rpcConfig;
  }
}

export default config;
