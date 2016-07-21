var _ = require('lodash');
var async = require('async');
var $ = require('preconditions').singleton();

var log = require('npmlog');
log.debug = log.verbose;


var DEFAULT_TIMEOUT= 60000; // 60 s
/**
 * Query a server, using one of the given options
 *
 * @param {Object} opts
 * @param {Array} opts.hosts Array of hosts to query. Until the first success one.
 * @param {Array} opts.path Path to request in each server
 */
var requestList = function(args, cb) {
  $.checkArgument(args.hosts);
  request = args.request || require('request');

  if (!_.isArray(args.hosts))
    args.hosts = [args.hosts];

  args.timeout = args.timeout || DEFAULT_TIMEOUT;

  var urls = _.map(args.hosts, function(x) {
    return (x + args.path);
  });
  var nextUrl, result, success;

  async.whilst(
    function() {
      nextUrl = urls.shift();
      return nextUrl && !success;
    },
    function(a_cb) {
      args.uri = nextUrl;
      request(args, function(err, res, body) {
        if (err) {
          log.warn('REQUEST FAIL: ' + nextUrl + ' ERROR: ' + err);
        }

        if (res) {
          success = !!res.statusCode.toString().match(/^[1234]../);
          if (!success) {
            log.warn('REQUEST FAIL: ' + nextUrl + ' STATUS CODE: ' + res.statusCode);
          }
        }

        result = [err, res, body];
        return a_cb();
      });
    },
    function(err) {
      if (err) return cb(err);
      return cb(result[0], result[1], result[2]);
    }
  );
};

module.exports = requestList;
