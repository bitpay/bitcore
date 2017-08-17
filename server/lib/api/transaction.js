const logger = require('../logger');
const request = require('request');
const config = require('../../config');
const db = require('../db');

const API_URL = `http://${config.bcoin_http}:${config.bcoin['http-port']}`;
const MAX_TXS = config.api.max_txs;
const TTL     = config.api.request_ttl;

module.exports = function transactionAPI(router) {
  // Txs by txid
  router.get('/tx/:txid', (req, res) => {
    // Get max block height for calculating confirmations
    const height = db.blocks.bestHeight();
    // Bcoin transaction data
    return request(`${API_URL}/tx/${req.params.txid}`,
      { timeout: TTL },
      (error, localRes, tx) => {
        if (error) {
          logger.log('error',
            `${error}`);
          return res.status(404).send();
        }
        // Catch JSON errors
        try {
          tx = JSON.parse(tx);
        } catch (e) {
          logger.log('error',
            `${e}`);
          return res.status(404).send();
        }
        if (!tx || !tx.hash) {
          logger.log('error',
            'No results found');
          return res.status(404).send();
        }

        // Return UI JSON
        return res.send({
          txid: tx.hash,
          version: tx.version,
          time: tx.ps,
          blocktime: tx.ps,
          locktime: tx.locktime,
          blockhash: tx.block,
          fees: tx.fee / 1e8,
          confirmations: (height - tx.height) + 1,
          valueOut: tx.outputs.reduce((sum, output) => sum + output.value, 0) / 1e8,
          vin: tx.inputs.map(input => ({
            addr: input.coin ? input.coin.address : '',
            value: input.coin ? input.coin.value / 1e8 : 0,
            scriptSig: {
              asm: input.script,
            },
          })),
          vout: tx.outputs.map(output => ({
            scriptPubKey: {
              asm: output.script,
              addresses: [output.address],
            },
            value: output.value / 1e8,
          })),
          isCoinBase: tx.inputs[0].prevout.hash === '0000000000000000000000000000000000000000000000000000000000000000',
        });
      });
  });

  // /txs is overloaded. Next ver separate concerns
  // query by block
  // query by address
  // last n txs
  router.get('/txs', (req, res) => {
    const pageNum    = parseInt(req.query.pageNum, 10)  || 0;
    const rangeStart = pageNum * MAX_TXS;
    const rangeEnd   = rangeStart + MAX_TXS;
    // get txs for blockhash, start with best height to calc confirmations
    if (req.query.block) {
      const height = db.blocks.bestHeight();
      // Get Bcoin data
      return request(`${API_URL}/block/${req.query.block}`,
        { timeout: TTL },
        (error, localRes, block) => {
          if (error) {
            logger.log('error',
              `${error}`);
            return res.status(404).send();
          }
          // Catch JSON errors
          try {
            block = JSON.parse(block);
          } catch (e) {
            logger.log('error',
              `${e}`);
            return res.status(404).send();
          }

          if (block.error) {
            logger.log('error',
              `${'No tx results'}`);
            return res.status(404).send();
          }
          //  Setup UI JSON
          const totalPages = Math.ceil(block.txs.length / MAX_TXS);
          block.txs = block.txs.slice(rangeStart, rangeEnd);

          return res.send({
            pagesTotal: totalPages,
            txs: block.txs.map(tx => ({
              txid: tx.hash,
              fees: tx.fee / 1e8,
              confirmations: (height - block.height) + 1,
              valueOut: tx.outputs.reduce((sum, output) => sum + output.value, 0) / 1e8,
              vin: tx.inputs.map(input => ({
                addr: input.coin ? input.coin.address : '',
                value: input.coin ? input.coin.value / 1e8 : 0,
                scriptSig: {
                  asm: input.script,
                },
              })),
              vout: tx.outputs.map(output => ({
                scriptPubKey: {
                  asm: output.script,
                  addresses: [output.address],
                },
                value: output.value / 1e8,
              })),
              isCoinBase: tx.inputs[0].prevout.hash === '0000000000000000000000000000000000000000000000000000000000000000',
            })),
          });
        });
    } else if (req.query.address) {
      // Get txs by address, start with best height to calc confirmations
      const height = db.blocks.bestHeight();
      const addr = req.query.address || '';

      logger.log('debug',
        'Warning: Requesting data from Bcoin by address, may take some time');

      return request(`${API_URL}/tx/address/${addr}`,
        { timeout: TTL },
        (error, localRes, txs) => {
          if (error) {
            logger.log('error',
              `${error}`);
            return res.status(404).send();
          }
          // Catch JSON errors
          try {
            txs = JSON.parse(txs);
          } catch (e) {
            logger.log('error',
              `${e}`);
            return res.status(404).send();
          }
          // Bcoin returns error as part of data object
          if (txs.error) {
            logger.log('error',
              `${'No tx results'}`);
            return res.status(404).send();
          }
          // Setup UI JSON
          return res.send({
            pagesTotal: 1,
            txs: txs.map(tx => ({
              txid: tx.hash,
              fees: tx.fee / 1e8,
              confirmations: (height - tx.height) +  1,
              valueOut: tx.outputs.reduce((sum, output) => sum + output.value, 0) / 1e8,
              vin: tx.inputs.map(input => ({
                addr: input.coin ? input.coin.address : '',
                value: input.coin ? input.coin.value / 1e8 : 0,
                scriptSig: {
                  asm: input.script,
                },
              })),
              vout: tx.outputs.map(output => ({
                scriptPubKey: {
                  asm: output.script,
                  addresses: [output.address],
                },
                value: output.value / 1e8,
              })),
              isCoinBase: tx.inputs[0].prevout.hash === '0000000000000000000000000000000000000000000000000000000000000000',
            })),
          });
        });
    }
    // Get last n txs
    return res.status(404).send({ error: 'Block hash or address expected' });
  });

  router.get('/rawtx/:txid', (req, res) => {
    res.send(req.params.txid);
  });

  router.post('/tx/send', (req, res) => {
    const rawtx = req.body.rawtx || '';
    request.post({
      url: `${API_URL}/broadcast`,
      body: { tx: rawtx },
      json: true,
    }, (err, localRes, body) => {
      if (err) {
        logger.log('error',
          `${err}`);
        res.status(400).send(err);
        return;
      }

      res.json(true);
    });
  });
};
