function bootstrap(app) {
  const fs = require('fs');
  const router = require('express').Router({mergeParams: true});
  const config = require('../config');
  const chains = Object.keys(config.chains);
  const networks = {};
  for (let chain of chains) {
    for (let network of Object.keys(config.chains[chain])) {
      Object.assign(networks, { [chain]: { [network]: true } });
    }
  }

  fs.readdirSync(__dirname + '/').forEach(function (file) {
    if (file.match(/\.js$/) !== null && file !== 'index.js') {
      var route = require('./' + file);
      router.use(route.path, route.router);
    }
  });

  app.use((req, resp, next) => {
    let { chain, network } = req.params;
    const hasChain = chains.includes(chain);
    const chainNetworks = networks[chain] || null;
    const hasChainNetworks = chainNetworks != null;
    const hasNetworkForChain = hasChainNetworks ? chainNetworks[network] : false;

    if (chain && !hasChain) {
      return resp.status(500).send(`This node is not configured for the chain ${chain}`);
    }
    if (network && (!hasChainNetworks || !hasNetworkForChain)) {
      return resp.status(500).send(`This node is not configured for the network ${network} on chain ${chain}`);
    }
    next();
  });

  return router;
}


module.exports = bootstrap;
