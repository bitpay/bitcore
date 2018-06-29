'use strict';
const os = require('os');
const fs = require('fs');

let foundPath;
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
        foundConfig = walletConfig;
        foundPath = path;
      } catch (e) {
        foundConfig = undefined;
      }
    }
  }
  return foundConfig;
}

const Config = () => {
  let foundConfig = findConfig();
  let config = {
    baseURL: 'http://127.0.0.1:3000/api',
    wallets: [],
    save: function() {
      fs.writeFileSync(foundPath, JSON.stringify(this))
    },
    addWallet: function(path) {
      const lastSlash = path.lastIndexOf('/');
      const configName = path.slice(lastSlash + 1);
      const configPath = path.slice(0, lastSlash);
      this.wallets.push({name: configName, path: configPath});
      this.save();
    }
  }
  const mergedConfig = Object.assign({}, config, foundConfig);
  return mergedConfig;
};

module.exports = Config();
