const Bcoin = require('./lib/node');
const config = require('./config');
const logger = require('./lib/logger');
const Api = require('./lib/api').server;
const db = require('./lib/db');

logger.log('debug',
  'Debug mode started');

db.connect(config.mongodb.uri, config.mongodb.options);

db.connection.once('open', () => {
  db.blocks.getBestBlockHeight((err, bestBlockHeight) => {
    // Pass height to node to start Sync
    logger.log('debug',
      `Starting Bcoin from best height: ${bestBlockHeight}`);

    if (config.start_node) Bcoin.start(bestBlockHeight);

    Api.listen(config.api.port, () => {
      logger.log('debug',
        'listening on port 3000');
    });
  });
});
