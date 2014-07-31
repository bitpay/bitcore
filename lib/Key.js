var Key = require('bindings')('KeyModule').Key;
var CommonKey = require('./common/Key');

for (var i in CommonKey) {
  if (CommonKey.hasOwnProperty(i))
    Key[i] = CommonKey[i];
}

module.exports = Key;
