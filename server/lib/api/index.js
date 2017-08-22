const express    = require('express');
const config     = require('../../config');
const bodyParser = require('body-parser');
const helmet     = require('helmet');

const app = express();
const api = express.Router();
const cors = require('./cors');

app.use(cors);
app.use(helmet());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Serve insight ui front end from root dir public folder
app.use(express.static('../app/www', { maxage: '1w' }));

app.set('json spaces', config.api.json_spaces);

//  Pass router to register the routes
const AddressAPI     = require('./address')(api);
const BlockAPI       = require('./block')(api);
const CurrencyAPI    = require('./currency')(api);
const StatusAPI      = require('./status')(api);
const TransactionAPI = require('./transaction')(api);
const MessageAPI     = require('./message')(api);

app.use('/api', api);

// 404
app.use((req, res) => res.status(404).send({
  status: 404,
  url: req.originalUrl,
  error: 'Not found',
}));

// Socket server
const server  = require('http').Server(app);

module.exports = server;
