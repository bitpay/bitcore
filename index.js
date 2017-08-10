const Bcoin = require('./lib/node');
const config = require('./config');
const logger = require('./lib/logger');
const Api = require('./lib/api');
const db = require('./lib/db');

logger.log('debug',
  'Debug mode started');

db.connect(config.mongodb.uri, config.mongodb.options);

db.connection.once('open', () => {

  if (config.start_node) Bcoin.start();

  Api.listen(config.api.port, () => {
    logger.log('debug',
      'listening on port 3000');
  });
});



