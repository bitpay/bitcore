const Bcoin = require('./lib/node');
const config = require('./config');
const logger = require('./lib/logger');
const Api = require('./lib/api').server;
const db = require('./lib/db');

logger.log('debug',
  'Debug mode started');

db.connect(config.mongodb.uri, config.mongodb.options);


db.connection.once('open', () => {
  // DB Audit returns best height to node
  db.blocks.findMissingBlocks((err, lastBestHeight) => {
    // Pass height to node to start Sync
    if (config.start_node) Bcoin.start(lastBestHeight);

    Api.listen(config.api.port, () => {
      logger.log('debug',
        'listening on port 3000');
    });
  });
});
