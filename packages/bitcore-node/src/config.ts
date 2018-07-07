import * as os from "os";
import parseArgv from "./utils/parseArgv";
import ConfigType from "./types/Config";
let program = parseArgv([], ["config"]);

function findConfig(): ConfigType | undefined {
  let foundConfig;
  const envConfigPath = process.env.BITCORE_CONFIG_PATH;
  const argConfigPath = program.config;
  const configFileName = "bitcore.config.json";
  let bitcoreConfigPaths = [
    `${os.homedir()}/${configFileName}`,
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
        const bitcoreConfig = require(path) as { bitcoreNode: ConfigType };
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
    pruneSpentScripts: true,
    port: 3000,
    dbHost: process.env.DB_HOST || "127.0.0.1",
    dbName: process.env.DB_NAME || "bitcore",
    numWorkers: os.cpus().length,
    chains: {}
  };

  let foundConfig = findConfig();
  Object.assign(config, foundConfig, {});
  if (!Object.keys(config.chains).length) {
    Object.assign(config.chains, {
      BTC: {
        mainnet: {
          chainSource: "p2p",
          trustedPeers: [{ host: "127.0.0.1", port: 8333 }],
          rpc: {
            host: "127.0.0.1",
            port: 8332,
            username: "bitcoin",
            password: "bitcoin"
          }
        }
      }
    });
  }
  config = setTrustedPeers(config);
  return config;
};

export default Config();
