const Block  = require('../../models/block.js');
const logger = require('../logger');

module.exports = function BlockAPI(app) {
  app.get('/block/:blockHash', (req, res) => {
    Block.find({ hash: req.params.blockHash },
      { _id: 0 },
      (err, block) => {
        if (err) {
          res.status(501).send();
          logger.log('err', err);
        }
        res.json(block[0]);
      });
  });

  app.get('/blocks', (req, res) => {
    res.send({
      blocks: [],
      length: 0,
      pagination: {
      },
    });
  });

  app.get('/rawblock/:blockHash', (req, res) => {
    res.send(req.params.blockHash);
  });

  app.get('/block-index/:height', (req, res) => {
    res.send(req.params.height);
  });
};
