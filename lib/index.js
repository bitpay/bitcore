/**
 * @namespace P2P
 */

var Messages = require('./messages');

module.exports = {
  Message: require('./message'),
  Commands: require('./commands'),
  Inventory: require('./inventory'),
  BloomFilter: require('./bloomfilter'),
  Messages: Messages,
  messages: new Messages(),
  Peer: require('./peer'),
  Pool: require('./pool')
};
