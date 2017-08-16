const request = require('request');
const pkg = require('../../package.json');
const config = require('../../config');
const netCfg = require('bcoin/lib/net/common');
const logger = require('../logger');
const db = require('../db');

const API_URL = `http://${config.bcoin_http}:${config.bcoin['http-port']}/`;

// Retrieve Bcoin status
function getStatus(cb) {
  request(`${API_URL}`, (err, localRes, status) => {
    if (err) {
      logger.log('error',
        `getStatus ${err}`);
      return cb(err);
    }
    try {
      status = JSON.parse(status);
    } catch (e) {
      logger.log('error',
        `getStatus JSON.parse: ${e}`);
      return cb(e);
    }
    return cb(null, status);
  });
}
// UI assigns Multiple Responsibilities depending on params
module.exports = function statusAPI(router) {
  // Get last block hash or node status
  router.get('/status', (req, res) => {
    if (req.query.q === 'getLastBlockHash') {
      db.blocks.getBlock(
        {},
        { hash: 1 },
        1,
        (err, block) => {
          if (err) {
            logger.log('error',
              `${err}`);
            return res.status(404).send(err);
          }
          return res.send({
            syncTipHash: block.hash,
            lastblockhash: block.hash,
          });
        });
    } else {
      getStatus((err, status) => {
        if (err) {
          logger.log('err',
            `/status getStatus: ${err}`);
          return res.status(404).send(err);
        }
        if (!status) {
          logger.log('err',
            '/status getStatus: no Status');
          return  res.status(404).send();
        }
        return res.json({
          info: {
            version:         status.version,
            protocolversion: netCfg.PROTOCOL_VERSION,
            blocks:          status.chain.height,
            timeoffset:      status.time.offset,
            connections:     status.pool.outbound,
            proxy:           '',
            difficulty:      0,
            testnet:         status.network !== 'main',
            relayfee:        0,
            errors:          '',
            network:         status.network,
          },
        });
      });
    }
  });
  // Get Bcoin sync status
  router.get('/sync', (req, res) => {
    getStatus((err, status) => {
      if (err) {
        logger.log('err',
          `/sync: ${err}`);
        return res.status(404).send(err);
      }
      if (!status) {
        logger.log('err',
          '/sync: no status');
        return res.status(404).send();
      }
      return res.json({
        status:           status.chain.progress === 100 ? 'synced' : 'syncing',
        blockChainHeight: status.chain.height,
        syncPercentage:   Math.round(status.chain.progress * 100),
        height:           status.chain.height,
        error:            null,
        type:             'bcoin node',
      });
    });
  });
  // Copied from previous source
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
