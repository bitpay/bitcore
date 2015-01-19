'use strict';

var RootCerts = exports;

var certs = require('./rootcerts.json');

// Use hash table for efficiency:
var trusted = Object.keys(certs).reduce(function(trusted, key) {
  var pem = certs[key];
  pem = pem.replace(/-----BEGIN CERTIFICATE-----/g, '');
  pem = pem.replace(/-----END CERTIFICATE-----/g, '');
  pem = pem.replace(/\s+/g, '');
  trusted[pem] = key;
  return trusted;
}, {});

RootCerts.getTrusted = function(pem) {
  pem = RootCerts.parsePEM(pem)[0].pem;
  if (!Object.prototype.hasOwnProperty.call(trusted, pem)) {
    return;
  }
  return trusted[pem];
};

RootCerts.getCert = function(name) {
  name = name.replace(/^s+|s+$/g, '');
  if (!Object.prototype.hasOwnProperty.call(certs, name)) {
    return;
  }
  return certs[name];
};

RootCerts.parsePEM = function(pem) {
  pem = pem + '';
  var concatted = pem.trim().split(/-----BEGIN [^\-\r\n]+-----/);
  if (concatted.length > 2) {
    return concatted.reduce(function(out, pem) {
      if (!pem) {
        return out;
      }
      pem = RootCerts.parsePEM(pem)[0].pem;
      if (pem) {
        out.push(pem);
      }
      return out;
    }, []);
  }
  var type = /-----BEGIN ([^\-\r\n]+)-----/.exec(pem)[1];
  pem = pem.replace(/-----BEGIN [^\-\r\n]+-----/, '');
  pem = pem.replace(/-----END [^\-\r\n]+-----/, '');
  var parts = pem.trim().split(/(?:\r?\n){2,}/);
  var headers = {};
  if (parts.length > 1) {
    headers = parts[0].trim().split(/[\r\n]/).reduce(function(out, line) {
      var parts = line.split(/:[ \t]+/);
      var key = parts[0].trim().toLowerCase();
      var value = (parts.slice(1).join('') || '').trim();
      out[key] = value;
      return out;
    }, {});
    pem = parts.slice(1).join('');
  }
  pem = pem.replace(/\s+/g, '');
  var der = pem ? new Buffer(pem, 'base64') : null;
  return [{
    type: type,
    headers: headers,
    pem: pem,
    der: der,
    body: der || new Buffer([0])
  }];
};

RootCerts.certs = certs;
RootCerts.trusted = trusted;
