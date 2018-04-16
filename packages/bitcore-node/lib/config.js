const os = require('os');
const fs = require('fs');
const program = require('commander');

program
  .version('8.0.0')
  .option('-c, --config', 'The path to bitcore config')
  .parse(process.argv);

const Config = function() {
  let config = {
    maxPoolSize: 20,
    port: 3000,
    dbHost: process.env.DB_HOST || '127.0.0.1',
    dbName: process.env.DB_NAME || 'bitcore',
    numWorkers: os.cpus().length,
    chains: {}
  };

  let options;
  const envConfigPath = process.env.BITCORE_CONFIG_PATH;
  const argConfigPath = program.config;
  const configFileName = 'bitcore.config';
  let bitcoreConfigPaths = [
    `${os.homedir()}/${configFileName}`,
    `../../../${configFileName}`,
    `../${configFileName}`
  ];
  const overrideConfig = envConfigPath || argConfigPath;
  if (overrideConfig) {
    bitcoreConfigPaths.unshift(overrideConfig);
  }
  // No config specified. Search home, bitcore and cur directory
  for (let path of bitcoreConfigPaths) {
    if (!options) {
      try {
        options = require(path).bitcoreNode;
      } catch (e) {
        options = undefined;
      }
    }
  }
  Object.assign(config, options, {});
  if (!Object.keys(config.chains).length) {
    config.chains.BTC = {
      mainnet: {
        chainSource: 'p2p',
        trustedPeers: [{ host: '127.0.0.1', port: 8333 }]
      }
    };
  }
  for (let [chain, chainObj] of Object.entries(config.chains)) {
    for (let network of Object.keys(chainObj)) {
      let env = process.env;
      if (env[`TRUSTED_${chain}_PEER`]) {
        let peers = config.chains[chain][network].trustedPeers || [];
        peers.push({
          host: env[`TRUSTED_${chain}_PEER`],
          port: env[`TRUSTED_${chain}_PEER_PORT`]
        });
        config.chains[chain][network].trustedPeers = peers;
      }
    }
  }
  return config;
};

module.exports = new Config();
