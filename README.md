
# bitcore-wallet-client

[![Build Status](https://img.shields.io/travis/bitpay/bitcore-wallet-client.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-wallet-client) 
[![Coverage Status](https://coveralls.io/repos/bitpay/bitcore-wallet-client/badge.svg)](https://coveralls.io/r/bitpay/bitcore-wallet-client)


A client library for bitcore-wallet-service

# Quick Start

``` javascript
  var client = new Client({
    baseUrl: bwc_instance_url,
    verbose: true,
  });

 client.createWallet("my Wallet", "John", 2, 3, 'testnet', function(err, secret) {
    console.log(' Wallet Created. Share this secret with your copayers:' + secret);
    
 
# API

[TODO: Describe API calls? Or link jsdoc]
