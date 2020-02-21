'use strict';

var bitcore = require('bitcore-lib-cash');
var BufferUtil = bitcore.util.buffer;
var $ = bitcore.util.preconditions;
var _ = bitcore.deps._;
var utils;

module.exports = utils = {
  checkInventory: function(arg) {
    $.checkArgument(
      _.isUndefined(arg) ||
        (Array.isArray(arg) && arg.length === 0) ||
        (Array.isArray(arg) && !_.isUndefined(arg[0].type) && !_.isUndefined(arg[0].hash)),
      'Argument is expected to be an array of inventory objects'
    );
  },
  checkFinished: function checkFinished(parser) {
    if(!parser.finished()) {
      throw new Error('Data still available after parsing');
    }
  },
  getNonce: function getNonce() {
    return bitcore.crypto.Random.getRandomBuffer(8);
  },
  writeIP: function writeIP(ip, bw) {
    var words = ip.v6.split(':').map(function(s) {
      return new Buffer(s, 'hex');
    });
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      bw.write(word);
    }
  },
  writeAddr: function writeAddr(addr, bw) {
    if (_.isUndefined(addr)) {
      var pad = new Buffer(Array(26));
      bw.write(pad);
      return;
    }

    bw.writeUInt64LEBN(addr.services);
    utils.writeIP(addr.ip, bw);
    bw.writeUInt16BE(addr.port);
  },
  writeInventory: function writeInventory(inventory, bw) {
    bw.writeVarintNum(inventory.length);
    inventory.forEach(function(value) {
      bw.writeUInt32LE(value.type);
      bw.write(value.hash);
    });
  },
  parseIP: function parseIP(parser) {
    var ipv6 = [];
    var ipv4 = [];
    for (var a = 0; a < 8; a++) {
      var word = parser.read(2);
      ipv6.push(word.toString('hex'));
      if (a >= 6) {
        ipv4.push(word[0]);
        ipv4.push(word[1]);
      }
    }
    ipv6 = ipv6.join(':');
    ipv4 = ipv4.join('.');
    return {
      v6: ipv6,
      v4: ipv4
    };
  },
  parseAddr: function parseAddr(parser) {
    var services = parser.readUInt64LEBN();
    var ip = utils.parseIP(parser);
    var port = parser.readUInt16BE();
    return {
      services: services,
      ip: ip,
      port: port
    };
  },
  sanitizeStartStop: function sanitizeStartStop(obj) {
    /* jshint maxcomplexity: 10 */
    /* jshint maxstatements: 20 */
    $.checkArgument(_.isUndefined(obj.starts) || _.isArray(obj.starts));
    var starts = obj.starts;
    var stop = obj.stop;
    if (starts) {
      starts = starts.map(function(hash) {
        if (_.isString(hash)) {
          return BufferUtil.reverse(new Buffer(hash, 'hex'));
        } else {
          return hash;
        }
      });
    } else {
      starts = [];
    }

    for (var i = 0; i < starts.length; i++) {
      if (starts[i].length !== 32) {
        throw new Error('Invalid hash ' + i + ' length: ' + starts[i].length);
      }
    }

    stop = obj.stop;
    if (_.isString(stop)) {
      stop = BufferUtil.reverse(new Buffer(stop, 'hex'));
    }
    if (!stop) {
      stop = BufferUtil.NULL_HASH;
    }
    obj.starts = starts;
    obj.stop = stop;

    return obj;
  }
};
