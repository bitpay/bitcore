const node = require('./lib/node');
const logger = require('./lib/logger');
const Api = require('./lib/api');

logger.log('debug',
  'Debug mode started');

Api.listen(3000, () => {
  logger.log('debug',
    'listening on port 3000');
});

node.start();
