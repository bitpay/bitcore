const Block = require('../../models/block.js');

module.exports = function (app) {
  app.get('/block/:blockHash', (req, res) => {
    Block.find({ hash: req.params.blockHash }, (err, block) => {
      if (err) {
        console.log(err);
      }
      res.send(block);
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
