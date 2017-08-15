const Block  = require('../../models/block.js');
const Transaction = require('../../models/transaction');
const logger = require('../logger');
const request = require('request');
const config = require('../../config');

const MAX_TXS = 20;
const MAX_BLOCKS = 1;

// Shoe horned in. Not dry, also in blocks. Make db api later
function getBlock(params, options, limit, cb) {
  const defaultOptions = { _id: 0 };

  if (!Number.isInteger(limit)) {
    limit = MAX_BLOCKS;
  }

  Object.assign(defaultOptions, options);

  Block.find(
    params,
    defaultOptions,
    cb)
    .sort({ height: -1 })
    .limit(limit);
}


function getTransactions(params, options, cb) {
  const defaultOptions = { _id: 0 };

  Object.assign(defaultOptions, options);

  Transaction.find(
    params,
    defaultOptions,
    cb)
    .sort({ height: 1 })
    .limit(MAX_TXS);
}

module.exports = function transactionAPI(router) {
  router.get('/tx/:txid', (req, res) => {
    getBlock(
      {},
      { height: 1 },
      1,
      (err, block) => {
        if (err) {
          res.status(501).send();
          logger.log('err', err);
        }
        if (block[0]) {
          const height = block[0].height;
          request(`http://${config.bcoin_http}:${config.bcoin['http-port']}/tx/${req.params.txid}`, (err, localRes, body) => {
            if (err) {
              logger.log('error',
                `${err}`);
            }
            try {
              body = JSON.parse(body);
            } catch (e) {
              logger.log('error',
                `${err}`);
            }
            res.send({
              txid: body.hash,
              version: body.version,
              time: body.ps,
              blocktime: body.ps,
              locktime: body.locktime,
              blockhash: body.block,
              fees: body.fee / 1e8,
              confirmations: height - body.height,
              valueOut: body.outputs.reduce((sum, output) => sum + output.value, 0) / 1e8,
              vin: body.inputs.map(input => ({
                addr: input.coin ? input.coin.address : '',
                value: input.coin ? input.coin.value / 1e8 : 0,
              })),
              vout: body.outputs.map(output => ({
                scriptPubKey: {
                  addresses: [output.address],
                },
                value: output.value / 1e8,
              })),
              isCoinbase: body.inputs[0].prevout.hash === '0000000000000000000000000000000000000000000000000000000000000000',
            });
          });
        }
      });
  });

  // That callback hell
  router.get('/txs', (req, res) => {
    if (req.query.block) {
      getBlock(
        {},
        { height: 1 },
        1,
        (err, block) => {
          if (err) {
            res.status(501).send();
            logger.log('err', err);
          }
          if (block[0]) {
            const height = block[0].height;
            request(`http://${config.bcoin_http}:${config.bcoin['http-port']}/block/${req.query.block}`, (err, localRes, body) => {
              if (err) {
                logger.log('error',
                  `${err}`);
              }
              try {
                body = JSON.parse(body);
              } catch (e) {
                logger.log('error',
                  `${err}`);
              }
              res.send({
                pagesTotal: 1,
                txs: body.txs.map(tx => ({
                  txid: tx.hash,
                  fees: tx.fee / 1e8,
                  confirmations: height - body.height,
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
          }
        });
    } else if (req.query.address) {
      getBlock(
        {},
        { height: 1 },
        1,
        (err, block) => {
          if (err) {
            res.status(501).send();
            logger.log('err', err);
          }
          if (block[0]) {
            const height = block[0].height;
            request(`http://${config.bcoin_http}:${config.bcoin['http-port']}/tx/address/${req.query.address}`, (err, localRes, body) => {
              if (err) {
                logger.log('error',
                  `${err}`);
              }
              try {
                body = JSON.parse(body);
              } catch (e) {
                logger.log('error',
                  `${err}`);
              }
              res.send({
                pagesTotal: 1,
                txs: body.map(tx => ({
                  txid: tx.hash,
                  fees: tx.fee / 1e8,
                  confirmations: height - tx.height,
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
          }
        });
    } else {
      getTransactions(
        {},
        {},
        (err, txs) => {
          if (err) {
            res.status(501).send();
          }
          res.json({
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
    res.send('tx send stub');
  });
};
