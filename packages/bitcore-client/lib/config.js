'use strict';
const os = require('os');

function findConfig() {
  let foundConfig;
  const configFileName = 'wallet.config.json';
  let walletConfigPaths = [
    `${os.homedir()}/${configFileName}`,
    `../${configFileName}`,
    `../../${configFileName}`
  ];

  for (let path of walletConfigPaths) {
    if (!foundConfig) {
      try {
        const walletConfig = require(path);
        console.log((walletConfig));
        foundConfig = walletConfig.wallets;
        console.log(foundConfig);
      } catch (e) {
        foundConfig = undefined;
      }
    }
  }
  return foundConfig;
}

const Config = () => {
  let config = {
    baseURL: 'http://127.0.0.1:3000/api'
  }
  let foundConfig = findConfig();
  const mergedConfig = Object.assign({}, config, foundConfig);
  return mergedConfig;
};

module.exports = Config();
