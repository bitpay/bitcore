const node = require('./lib/node');
const config = require('./config/config.js');
const logger = require('./lib/logger');
const Api = require('./lib/api');

logger.log('debug',
  'Debug mode started');

Api.listen(config.api.port, () => {
  logger.log('debug',
    'listening on port 3000');
});

node.start();
