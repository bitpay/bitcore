import fs from 'fs';
import { cpus, homedir } from 'os';
import path from 'path';
import logger from './logger';
import { ConfigType } from './types/Config';
import { merge } from './utils';
import parseArgv from './utils/parseArgv';

const program = parseArgv([], ['config']);

function findConfig(): ConfigType | undefined {
  const DEFAULT_CONFIG = path.join(__dirname, '../../../../bitcore.config.json');
  let bitcoreConfigPath = program.config || process.env.BITCORE_CONFIG_PATH || DEFAULT_CONFIG;
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
  logger.info('Using config at: ' + bitcoreConfigPath);
  
  let rawBitcoreConfig;
  try {
    rawBitcoreConfig = fs.readFileSync(bitcoreConfigPath).toString();
  } catch (error) {
    throw new Error(`Error in loading bitcore config\nFound file at ${bitcoreConfigPath}\n${error}`);
  }
  
  let bitcoreConfig;
  try {
    bitcoreConfig = JSON.parse(rawBitcoreConfig).bitcoreNode;
  } catch (error) {
    throw new Error(`Error in parsing bitcore config\nFound and loaded file at ${bitcoreConfigPath}\n${error}`);
  }

  return bitcoreConfig;
}

function setTrustedPeers(config: ConfigType): ConfigType {
  for (const [chain, chainObj] of Object.entries(config)) {
    for (const network of Object.keys(chainObj)) {
      const env = process.env;
      const envString = `TRUSTED_${chain.toUpperCase()}_${network.toUpperCase()}_PEER`;
      if (env[envString]) {
        const peers = config.chains[chain][network].trustedPeers || [];
        peers.push({
          host: env[envString] as string,
          port: env[`${envString}_PORT`] as string
        });
        config.chains[chain][network].trustedPeers = peers;
      }
    }
  }
  return config;
}
const Config = function(): ConfigType {
  let config: ConfigType = {
    maxPoolSize: 50,
    port: 3000,
    dbUrl: process.env.DB_URL || '',
    dbHost: process.env.DB_HOST || '127.0.0.1',
    dbName: process.env.DB_NAME || 'bitcore',
    dbPort: process.env.DB_PORT || '27017',
    dbUser: process.env.DB_USER || '',
    dbPass: process.env.DB_PASS || '',
    numWorkers: cpus().length,
    chains: {},
    aliasMapping: {
      chains: {},
      networks: {}
    },
    services: {
      api: {
        rateLimiter: {
          disabled: false,
          whitelist: ['::ffff:127.0.0.1', '::1']
        },
        wallets: {
          allowCreationBeforeCompleteSync: false,
          allowUnauthenticatedCalls: false
        }
      },
      event: {
        onlyWalletEvents: false
      },
      p2p: {},
      socket: {
        bwsKeys: []
      },
      storage: {}
    },
    externalProviders: {
      moralis: {
        apiKey: 'string'
      }
    }
  };

  config = merge(config, findConfig());
  if (!Object.keys(config.chains).length) {
    Object.assign(config.chains, {
      BTC: {
        mainnet: {
          chainSource: 'p2p',
          trustedPeers: [{ host: '127.0.0.1', port: 8333 }],
          rpc: {
            host: '127.0.0.1',
            port: 8332,
            username: 'bitcoin',
            password: 'bitcoin'
          }
        }
      }
    });
  }
  if ((config as any).modules) {
    throw new Error('The config modules has moved! You can remove the `modules` array from your config to use the defaults, or if you need to use custom modules then you can specify the paths in the specific chain-network config objects with `modulePath`');
  }
  config = setTrustedPeers(config);
  return config;
};

export default Config();