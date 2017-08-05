const express        = require('express');
const config         = require('../../config');

const app = express();

app.set('json spaces', config.api.json_spaces);

//  Pass express to register the routes
const AddressAPI     = require('./address')(app);
const BlockAPI       = require('./block')(app);
const StatusAPI      = require('./status')(app);
const TransactionAPI = require('./transaction')(app);
const MessageAPI     = require('./message')(app);

// 404
app.use((req, res) => {
  res.status(404).send({
    status: 404,
    url: req.originalUrl,
    error: 'Not found',
  });
});

module.exports = app;
