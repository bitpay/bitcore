const express = require('express');
const config  = require('../../config');

const app = express();
const api = express.Router();

// Serve insight ui front end from root dir public folder
app.use('/', express.static('./public'));
app.use('/blocks', express.static('./public'));
app.use('/blocks-date/:date', express.static('./public'));
app.use('/block/:blockhash', express.static('./public'));
app.use('/tx/:txid', express.static('./public'));
app.use('/address/:addr', express.static('./public'));

app.set('json spaces', config.api.json_spaces);

//  Pass router to register the routes
const AddressAPI     = require('./address')(api);
const BlockAPI       = require('./block')(api);
const CurrencyAPI    = require('./currency')(api);
const StatusAPI      = require('./status')(api);
const TransactionAPI = require('./transaction')(api);
const MessageAPI     = require('./message')(api);

app.use('/insight-api', api);

// 404
app.use((req, res) => {
  res.status(404).send({
    status: 404,
    url: req.originalUrl,
    error: 'Not found',
  });
});

const server  = require('http').Server(app);
const io = require('socket.io')(server);

const SocketAPI = require('./socket')(io);

module.exports = {
  server,
  io,
};
