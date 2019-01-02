#!/usr/bin/env node

var fs = require('fs');
var url = require('url');
var http = require('http');
var path = require('path');
var Stream = require('stream').Stream;
var StringDecoder = require('string_decoder').StringDecoder;

var certUrl = 'https://raw.githubusercontent.com/nodejs/node/master/src/node_root_certs.h';

/**
 * Get Root Certs
 */
function getRootCerts(callback) {
  return request(certUrl, function(err, res, body) {
    if (err) return callback(err);

    // Delete preprocesor macros
    body = body.replace(/#[^\n]+/g, '');



    // Delete the trailing comma
    body = body.replace(/,\s*$/, '');

    // Make sure each C string is concatenated
    body = body.replace(/"\r?\n"/g, '');


    // Make sue we turn the cert names into property names
    body = body.replace(/\/\*([^*]+)\*\/\n(?=")/g, function(_, name) {
      var key = name.trim();
      return '"' + key + '":\n';
    });

    // Delete Comments
    body = body.replace(/\/\* tools\/\.\.\/src[^\0]+?\*\//, '');
    body = body.replace(/\/\* @\(#\)[^\n]+/, '');


    // \xff -> \u00ff
    body = body.replace(/\\x([0-9a-fA-F]{2})/g, '\\u00$1');

    // Trim Whitespace
    body = body.trim();

    // Wrap into a JSON Object
    body = '{\n' + body + '\n}\n';

    // Ensure JSON parses properly
    try {
      body = JSON.stringify(JSON.parse(body), null, 2);
    } catch (e) {
      return callback(e);
    }

    return callback(null, body);
  });
}

/**
 * Helpers
 */
function request(options, callback) {
  if (typeof options === 'string' || options.hostname) {
    options = { uri: options };
  }

  var uri = options.uri || options.url
    , body = options.json
        ? JSON.stringify(options.json)
        : options.body || '';

  if (typeof uri !== 'object') {
    uri = url.parse(uri);
  }

  if (options.qs) {
    var query = uri.query ? qs.parse(uri.query) : {};
    Object.keys(options.qs).forEach(function(key) {
      query[key] = options.qs[key];
    });
    uri.path = uri.pathname + '?' + qs.stringify(query);
  }

  var protocol = uri.protocol === 'https:'
    ? require('https')
    : http;

  options.method = options.method || (body ? 'POST' : 'GET');
  options.method = options.method.toUpperCase();
  options.headers = options.headers || {};

  options.headers['Accept'] = options.headers['Accept'] || 'text/plain; charset=utf-8';

  if (options.json) {
    options.headers['Content-Type'] = 'application/json; charset=utf-8';
    options.headers['Accept'] = 'application/json';
  }

  if (options.method !== 'GET' && options.method !== 'HEAD') {
    options.headers['Content-Length'] = Buffer.byteLength(body);
  }

  var opt = {
    auth: uri.auth,
    host: uri.hostname,
    port: uri.port || (protocol === http ? 80 : 443),
    path: uri.path,
    method: options.method,
    headers: options.headers
  };


  var req = protocol.request(opt)
    , response = new Stream;

  req.on('error', function(err) {
    if (callback) {
      callback(err);
    } else {
      response.emit('error', err);
    }
  });

  req.on('response', function(res) {
    var decoder = new StringDecoder('utf8')
      , done = false
      , body = '';

    function end() {
      if (done) return;
      done = true;
      if (callback) {
        res.body = body;
        if (options.json) {
          try {
            body = JSON.parse(body);
          } catch (e) {
            ;
          }
        }
        callback(null, res, body);
      } else {
        response.emit('end');
      }
      res.socket.removeListener('error', error);
      res.socket.removeListener('end', end);
    }

    function error(err) {
      res.destroy();
      if (callback) {
        callback(err);
      } else {
        response.emit('error', err);
      }
    }

    res.on('data', function(data) {
      if (callback) {
        body += decoder.write(data);
      } else {
        response.emit('data', data);
      }
    });

    res.on('error', error);
    res.socket.on('error', error);

    res.on('end', end);
    // An agent socket's `end` sometimes
    // wont be emitted on the response.
    res.socket.on('end', end);
  });

  req.end(body);

  return response;
}

/**
 * Execute
 */

function main(argv, callback) {
  if (!callback) {
    callback = argv;
    argv = null;
  }
  console.log('Retrieving root certs from: %s', certUrl);
  return getRootCerts(function(err, certs) {
    if (err) {
      console.log('Error', err);
      return callback();
    }
    var file = path.resolve(__dirname, 'lib', 'rootcerts.json');
    return fs.writeFile(file, certs, function(err) {
      if (err) return callback(err);
      console.log('Root cert code generated at: %s.', file);
      return callback();
    });
  });
}

if (!module.parent) {
  process.title = 'root-certs';
  main(process.argv.slice(), function(err, code) {
    if (err) throw err;
    return process.exit(code || 0);
  });
} else {
  module.exports = main;
}
