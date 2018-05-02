const os = require('os');
const parseArgv = require('./utils/parseArgv');
let program = parseArgv([], ['config']);

function findConfig() {
  let foundConfig;
  const envConfigPath = process.env.BITCORE_CONFIG_PATH;
  const argConfigPath = program.config;
  const configFileName = 'bitcore.config.json';
  let bitcoreConfigPaths = [
    `${os.homedir()}/${configFileName}`,
    `../../../${configFileName}`,
    `../${configFileName}`
  ];
  const overrideConfig = argConfigPath || envConfigPath;
  if (overrideConfig) {
    bitcoreConfigPaths.unshift(overrideConfig);
  }
  // No config specified. Search home, bitcore and cur directory
  for (let path of bitcoreConfigPaths) {
    if (!foundConfig) {
      try {
        const bitcoreConfig = require(path);
        foundConfig = bitcoreConfig.bitcoreNode;
      } catch (e) {
        foundConfig = undefined;
      }
    }
  }
  return foundConfig;
}

function setTrustedPeers(config) {
  for (let [chain, chainObj] of Object.entries(config.chains)) {
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
const Config = function() {
  let config = {
    maxPoolSize: 20,
    port: 3000,
    dbHost: process.env.DB_HOST || '127.0.0.1',
    dbName: process.env.DB_NAME || 'bitcore',
    numWorkers: os.cpus().length,
    chains: {}
  };

  let foundConfig = findConfig();
  Object.assign(config, foundConfig, {});
  if (!Object.keys(config.chains).length) {
    config.chains.BTC = {
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
    };
  }
  config = setTrustedPeers(config);
  return config;
};

module.exports = new Config();
