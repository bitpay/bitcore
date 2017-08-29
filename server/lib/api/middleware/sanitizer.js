const util = require('../../util');

// Strip the request, sanitize inputs, rebuild
module.exports = function sanitize(req, res, next) {
  const params = req.params || null;
  const body   = req.body || null;
  const query  = req.query || null;

  let cleanParams = null;
  let cleanBody   = null;
  let cleanQuery  = null;

  // req.params
  if (params) {
    // Transaction Id
    if (params.txid  && !util.isTxid(params.txid)) {
      return res.status(404).send({
        error: 'Invalid Transaction Id',
      });
    }
    // Address
    if (params.addr && typeof (params.addr) !== 'string') {
      return res.status(404).send({
        error: 'Invalid Bitcoin Address',
      });
    }
    // Block Hash
    if (params.blockHash && typeof (params.blockHash) !== 'string')  {
      return res.status(404).send({
        error: 'Invalid Block Hash',
      });
    }
    // Height
    if (params.height) {
      if (typeof (params.height) !== 'number')  {
        return res.status(404).send({
          error: 'Invalid Block Hash',
        });
      }
      params.height = parseInt(params.height, 10);
    }

    cleanParams = {
      txid:      params.txid      || null,
      addr:      params.addr      || null,
      blockHash: params.blockHash || null,
      height:    params.height    || null,
    };
  }

  // req.body
  if (body) {
    // Signature
    if (body.signature && typeof (body.signature) !== 'string') {
      return res.status(404).send({
        error: 'Invalid Signature',
      });
    }
    // Message
    if (body.message && typeof (body.message) !== 'string') {
      return res.status(404).send({
        error: 'Invalid Message',
      });
    }
    // Address
    if (body.address && !util.isBitcoinAddress(body.address)) {
      return res.status(404).send({
        error: 'Invalid Bitcoin Address',
      });
    }
    cleanBody = {
      signature: body.signature || null,
      message:   body.message   || null,
      address:   body.address   || null,
    };
  }

  if (query) {
    // Address
    if (query.address && !util.isBitcoinAddress(query.address)) {
      return res.status(404).send({
        error: 'Invalid Bitcoin Address',
      });
    }
    // Signature
    if (query.signature && typeof (query.signature) !== 'string') {
      return res.status(404).send({
        error: 'Invalid Signature',
      });
    }
    // Message
    if (query.message && typeof (query.message) !== 'string') {
      return res.status(404).send({
        error: 'Invalid Message',
      });
    }
    // q
    if (query.q && typeof (query.q) !== 'string') {
      return res.status(404).send({
        error: 'Invalid Q',
      });
    }
    // Page Number
    if (query.pageNum && typeof (query.pageNum) !== 'number') {
      return res.status(404).send({
        error: 'Invalid Page Number',
      });
    }
    // Block (hash - implicit)
    if (query.block && typeof (query.block) !== 'string') {
      return res.status(404).send({
        error: 'Invalid Block',
      });
    }
    // Raw Tx
    if (query.rawtx && typeof (query.rawtx) !== 'string') {
      return res.status(404).send({
        error: 'Invalid Bitcoin Address',
      });
    }

    cleanQuery = {
      address:   query.address   || null,
      signature: query.signature || null,
      message:   query.message   || null,
      q:         query.q         || null,
      pageNum:   query.pageNum   || null,
      block:     query.block     || null,
      rawtx:     query.rawtx     || null,
    };
  }

  // Strip off unexpected params
  req.params = cleanParams;
  req.body   = cleanBody;
  req.query  = cleanQuery;

  return next();
};

