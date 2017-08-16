const logger = require('../logger');
const request = require('request');
const config = require('../../config');
const db = require('../db');

const API_URL = `http://${config.bcoin_http}:${config.bcoin['http-port']}`;
const MAX_TXS = config.api.max_txs;

module.exports = function transactionAPI(router) {
  // Txs by txid
  router.get('/tx/:txid', (req, res) => {
    // Get max block height for calculating confirmations
    db.blocks.getBestHeight(
      (err, blockHeight) => {
        if (err) {
          logger.log('err', err);
          return res.status(404).send();
        }
        const height = blockHeight;
        // Bcoin transaction data
        return request(`${API_URL}/tx/${req.params.txid}`, (error, localRes, tx) => {
          if (error) {
            logger.log('error',
              `${error}`);
            return res.status(404).send();
          }
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
          return res.send({
            txid: tx.hash,
            version: tx.version,
            time: tx.ps,
            blocktime: tx.ps,
            locktime: tx.locktime,
            blockhash: tx.block,
            fees: tx.fee / 1e8,
            confirmations: height - tx.height + 1,
            valueOut: tx.outputs.reduce((sum, output) => sum + output.value, 0) / 1e8,
            vin: tx.inputs.map(input => ({
              addr: input.coin ? input.coin.address : '',
              value: input.coin ? input.coin.value / 1e8 : 0,
            })),
            vout: tx.outputs.map(output => ({
              scriptPubKey: {
                addresses: [output.address],
              },
              value: output.value / 1e8,
            })),
            isCoinbase: tx.inputs[0].prevout.hash === '0000000000000000000000000000000000000000000000000000000000000000',
          });
        });
      });
  });

  // /txs is overloaded. Next ver separate concerns
  router.get('/txs', (req, res) => {
    const pageNum    = parseInt(req.query.pageNum)  || 0;
    const rangeStart = pageNum * MAX_TXS;
    const rangeEnd   = rangeStart + MAX_TXS;
    // get txs for blockhash, start with best height to calc confirmations
    if (req.query.block) {

      db.blocks.getBestHeight(
        (err, blockHeight) => {
          if (err) {
            logger.log('err', err);
            return res.status(404).send();
          }
          const height = blockHeight;
          // Get Bcoin data
          return request(`${API_URL}/block/${req.query.block}`, (error, localRes, block) => {
            if (error) {
              logger.log('error',
                `${error}`);
            }
            try {
              block = JSON.parse(block);
            } catch (e) {
              logger.log('error',
                `${e}`);
              return res.status(404).send();
            }
            if (!block.txs.length) {
              logger.log('error',
                `${'No tx results'}`);
              res.status(404).send();
            }
            const totalPages = Math.ceil(block.txs.length / MAX_TXS);
            block.txs = block.txs.slice(rangeStart, rangeEnd);

            return res.send({
              pagesTotal: totalPages,
              txs: block.txs.map(tx => ({
                txid: tx.hash,
                fees: tx.fee / 1e8,
                confirmations: height - block.height + 1,
                valueOut: tx.outputs.reduce((sum, output) => sum + output.value, 0) / 1e8,
                vin: tx.inputs.map(input => ({
                  addr: input.coin ? input.coin.address : '',
                  value: input.coin ? input.coin.value / 1e8 : 0,
                })),
                vout: tx.outputs.map(output => ({
                  scriptPubKey: {
                    addresses: [output.address],
                  },
                  value: output.value / 1e8,
                })),
                output: tx.outputs,
              })),
            });
          });
        });
    } else if (req.query.address) {
      // Get txs by address, start with best height to calc confirmations
      db.blocks.getBestHeight(
        (err, blockHeight) => {
          if (err) {
            logger.log('err', err);
            return res.status(404).send();
          }

          const height = blockHeight;
          const addr = req.query.address || '';

          return request(`${API_URL}/tx/address/${req.query.address}`, (error, localRes, txs) => {
            if (error) {
              logger.log('error',
                `${error}`);
              return res.status(404).send();
            }
            try {
              txs = JSON.parse(txs);
            } catch (e) {
              logger.log('error',
                `${e}`);
              return res.status(404).send();
            }
            return res.send({
              pagesTotal: 1,
              txs: txs.map(tx => ({
                txid: tx.hash,
                fees: tx.fee / 1e8,
                confirmations: height - tx.height +  1,
                valueOut: tx.outputs.reduce((sum, output) => sum + output.value, 0) / 1e8,
                vin: tx.inputs.map(input => ({
                  addr: input.coin ? input.coin.address : '',
                  value: input.coin ? input.coin.value / 1e8 : 0,
                })),
                vout: tx.outputs.map(output => ({
                  scriptPubKey: {
                    addresses: [output.address],
                  },
                  value: output.value / 1e8,
                })),
                output: tx.outputs,
              })),
            });
          });
        });
    } else {
      // Get last n txs
      db.txs.getTransactions(
        {},
        {},
        MAX_TXS,
        (err, txs) => {
          if (err) {
            logger.log('err',
              `getTransactions: ${err}`);
            res.status(404).send();
          }
          return res.json({
            pagesTotal: 1,
            txs: txs.map(tx => ({
              txid: tx.hash,
              version: tx.version,
              locktime: tx.locktime,
              vin: tx.inputs.map(input => ({
                coinbase: input.script,
                sequence: input.sequence,
                n: 0,
              })),
              vout: tx.outputs.map(output => ({
                value: output.value,
                n: 0,
                scriptPubKey: {
                  hex: '',
                  asm: '',
                  addresses: [output.address],
                  type: output.type,
                },
                spentTxid: '',
                spentIndex: 0,
                spentHeight: 0,
              })),
            })),
          });
        },
      );
    }
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
