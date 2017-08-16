const Message = require('bitcore-message');

// Copied from previous source
function verifyMessage(req, res) {
  const address   = req.body.address || req.query.address;
  const signature = req.body.signature || req.query.signature;
  const message   = req.body.message || req.query.message;
  if (!address || !signature || !message) {
    res.json({
      message: 'Missing parameters (expected "address", "signature" and "message")',
      code: 1,
    });
    return;
  }
  let valid;
  try {
    valid = new Message(message).verify(address, signature);
  } catch (err) {
    res.json({
      message: `Unexpected error: ${err.message}`,
      code: 1,
    });
    return;
  }
  res.json({ result: valid });
}

module.exports = function messageAPI(router) {
  router.get('/messages/verify', (req, res) => {
    verifyMessage(req, res);
  });

  router.post('/messages/verify', (req, res) => {
    verifyMessage(req, res);
  });

  router.get('/utils/estimatefee', (req, res) => {
    res.send('estimate fees');
  });
};
