'use strict';


exports.index = function(req, res) {
  var _xhr = function() {
    if (typeof ActiveXObject !== 'undefined' && ActiveXObject !== null) {
      return new ActiveXObject('Microsoft.XMLHTTP');
    } else if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest !== null) {
      return new XMLHttpRequest();
    } else if (typeof require !== 'undefined' && require !== null) {
      var XMLhttprequest = require('xmlhttprequest').XMLHttpRequest;
      return new XMLhttprequest();
    }
  };

  var _request = function(url, cb) {
    var request;
    request = _xhr();
    request.open('GET', url, true);
    request.onreadystatechange = function() {
      if (request.readyState === 4) {
        if (request.status === 200) {
          return cb(false, request.responseText);
        } else {
          return cb(true, {
            status: request.status,
            message: 'Request error'
          });
        }
      }
    };

    return request.send(null);
  };

  _request('https://www.bitstamp.net/api/ticker/', function(err, data) {
    if (err) {
      return res.jsonp({
        status: err.status,
        message: err.message
      });
    }

    var bitstamp = JSON.parse(data);

    res.jsonp({
      status: 200,
      data: {
        bitstamp: parseFloat(bitstamp.last)
      }
    });
  });
};
