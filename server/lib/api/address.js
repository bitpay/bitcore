const Block = require('../../models/block.js');
const logger = require('../logger');

const MAX_BLOCKS = 200;

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

module.exports = function AddressAPI(router) {
  router.get('/addr/:addr', (req, res) => {
    res.json({
      addrStr:                 req.params.addr,
      balance:                 0,
      balanceSat:              0,
      totalReceived:           0,
      totalReceivedSat:        0,
      totalSent:               0,
      totalSentSat:            0,
      unconfirmedBalance:      0,
      unconfirmedBalanceSat:   0,
      unconfirmedTxApperances: 0,
      txApperances:            5,
    });
  });

  router.get('/addr/:addr/utxo', (req, res) => {
    res.send('1');
  });

  router.get('/addr/:addr/balance', (req, res) => {
    res.send('2');
  });

  router.get('/addr/:addr/totalReceived', (req, res) => {
    res.send('3');
  });

  router.get('/addr/:addr/totalSent', (req, res) => {
    res.send('4');
  });

  router.get('/addr/:addr/unconfirmedBalance', (req, res) => {
    res.send('5');
  });

  router.get('/addrs/:addrs/utxo', (req, res) => {
    res.send('6');
  });

  router.post('/addrs/utxo', (req, res) => {
    res.send('7');
  });

  router.get('/addrs/:addrs/txs', (req, res) => {
    getBlock(
      {
        $or:
        [
          { 'txs.outputs.address': req.params.addr },
          { 'txs.inputs.prevout.hash': req.params.addr },
        ],
      },
      { rawBlock: 0 },
      MAX_BLOCKS,
      (err, block) => {
        if (err) {
          res.status(501).send();
          logger.log('err', err);
        }

        if (block[0]) {
          const b = block[0];
          res.json({
            pagesTotal: 1,
            txs: b.txs.map(tx => ({
              txid: tx.hash,
              version: tx.version,
              locktime: tx.locktime,
              vin: tx.inputs.map(input => ({
                coinbase: input.script,
                sequence: input.sequence,
                n: 0,
                addr: input.address,
              })),
              vout: tx.outputs.map(output => ({
                value: output.value / 1e8,
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
        } else {
          res.send();
        }
      });
  });

  router.post('/addrs/txs', (req, res) => {
    res.send('post stub');
  });
};
