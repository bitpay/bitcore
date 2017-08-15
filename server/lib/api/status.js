const request = require('request');
const Block = require('../../models/block');
const pkg = require('../../package.json');
const config = require('../../config');
const netCfg = require('bcoin/lib/net/common');
const logger = require('../logger');

// Here comes the ugly. Moo who haha
function getStatus(cb) {
  request(`http://${config.bcoin_http}:${config.bcoin['http-port']}/`, (err, localRes, body) => {
    if (err) {
      logger.log('error',
        `${err}`);
    }
    try {
      body = JSON.parse(body);
    } catch (e) {
      logger.log('error',
        `${err}`);
      cb(e);
    }
    cb(null, body);
  });
}

module.exports = function statusAPI(router) {
  router.get('/status', (req, res) => {
    if (req.query.q === 'getLastBlockHash') {
      Block.findOne({}, { 'hash': 1 }, { sort: { 'height': -1 } }, (err, block) => {
        if (err) {
          logger.log('error',
            `${err}`);
          res.status(501).send(err);
        } else {
          res.send({
            syncTipHash: block.hash,
            lastblockhash: block.hash,
          });
        }
      });
    } else {
      getStatus((err, status) => {
        if (err) {
          res.status(501).send(err);
        } else if (status) {
          res.json({
            info: {
              version: status.version,
              protocolversion: netCfg.PROTOCOL_VERSION,
              blocks: status.chain.height,
              timeoffset: status.time.offset,
              connections: status.pool.outbound,
              proxy: '',
              difficulty: 0,
              testnet: status.network !== 'main',
              relayfee: 0,
              errors: '',
              network: status.network,
            },
          });
        } else {
          res.send();
        }
      });
    }

  });

  router.get('/sync', (req, res) => {
    getStatus((err, status) => {
      if (err) {
        res.status(501).send(err);
      } else if (status) {
        res.json({
          status:           'syncing',
          blockChainHeight: status.chain.height,
          syncPercentage:   Math.round(status.chain.progress * 100),
          height:           status.chain.height,
          error:            null,
          type:             'bcoin node',
        });
      } else {
        res.send();
      }
    });
  });

  router.get('/peer', (req, res) => {
    res.json({
      connected: true,
      host: '127.0.0.1',
      port: null,
    });
  });

  router.get('/version', (req, res) => {
    res.json({
      version: pkg.version,
    });
  });
};
