
# bitcore-wallet-client

[![Build Status](https://img.shields.io/travis/bitpay/bitcore-wallet-client.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-wallet-client) 
[![Coverage Status](https://coveralls.io/repos/bitpay/bitcore-wallet-client/badge.svg)](https://coveralls.io/r/bitpay/bitcore-wallet-client)


The *official* client library for [bitcore-wallet-service] (https://github.com/bitpay/bitcore-wallet-service). 

# Description

This package communicated to BWS (Bitcore wallet service) using its REST API. All REST endpoints are wrapped on simple async call. All relevant responses from BWS are checked independently by the peers, thus the importance of using this library with talking with a third party BWS instance.

See [Bitcore-wallet] (https://github.com/bitpay/bitcore-wallet) for a simple CLI wallet implementation that relays on BWS and uses bitcore-wallet-client.


# Quick Start

``` javascript
  var client = new Client({
    baseUrl: bws_instance_url,
    verbose: true,
  });

 client.createWallet("my Wallet", "Irene", 2, 3, 'testnet', function(err, secret) {
    // Handle err
    console.log(' Wallet Created. Share this secret with your copayers:' + secret);
    fs.writeFileSync('wallet.dat', client.export());
 });
 
 // Then, from other Copayer
 
   var client = new Client({
    baseUrl: bws_instance_url,
    verbose: true,
  });

 client.joinWallet(secret,  "Thomas", function(err, secret) {
    // Handle err
    console.log(' Wallet Joined!);
    fs.writeFileSync('wallet.dat', client.export());
 });
 
```


# API

[TODO: Describe API calls? Or link jsdoc]
