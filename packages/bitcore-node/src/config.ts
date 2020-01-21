import { homedir, cpus } from 'os';
import parseArgv from './utils/parseArgv';
import { ConfigType } from './types/Config';
import * as _ from 'lodash';
let program = parseArgv([], ['config']);

function findConfig(): ConfigType | undefined {
  let foundConfig;
  const envConfigPath = process.env.BITCORE_CONFIG_PATH;
  const argConfigPath = program.config;
  const configFileName = 'bitcore.config.json';
  let bitcoreConfigPaths = [
    `${homedir()}/${configFileName}`,
    `../../../../${configFileName}`,
    `../../${configFileName}`
  ];
  const overrideConfig = argConfigPath || envConfigPath;
  if (overrideConfig) {
    bitcoreConfigPaths.unshift(overrideConfig);
  }
  // No config specified. Search home, bitcore and cur directory
  for (let path of bitcoreConfigPaths) {
    if (!foundConfig) {
      try {
        const expanded = path[0] === '~' ? path.replace('~', homedir()) : path;
        const bitcoreConfig = require(expanded) as { bitcoreNode: ConfigType };
        foundConfig = bitcoreConfig.bitcoreNode;
      } catch (e) {
        foundConfig = undefined;
      }
    }
  }
  return foundConfig;
}

function setTrustedPeers(config: ConfigType): ConfigType {
  for (let [chain, chainObj] of Object.entries(config)) {
    for (let network of Object.keys(chainObj)) {
      let env = process.env;
      const envString = `TRUSTED_${chain.toUpperCase()}_${network.toUpperCase()}_PEER`;
      if (env[envString]) {
        let peers = config.chains[chain][network].trustedPeers || [];
        peers.push({
          host: env[envString],
          port: env[`${envString}_PORT`]
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
    tokenContractAddresses: {},
    modules: ['./bitcoin', './bitcoin-cash', './ethereum', './ripple'],
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
    }
  };

  let foundConfig = findConfig();
  const mergeCopyArray = (objVal, srcVal) => (objVal instanceof Array ? srcVal : undefined);
  config = _.mergeWith(config, foundConfig, mergeCopyArray);
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
  if (!Object.keys(config.tokenContractAddresses).length) {
    Object.assign(config.tokenContractAddresses, {
      GUSD: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
      USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      PAX: '0x8e870d67f660d95d5be530380d0ec0bd388289e1'
    });
  }
  config = setTrustedPeers(config);
  return config;
};

export default Config();
