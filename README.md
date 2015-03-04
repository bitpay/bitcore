
# bitcore-wallet-client

[![Build Status](https://img.shields.io/travis/bitpay/bitcore-wallet-client.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-wallet-client) 
[![Coverage Status](https://coveralls.io/repos/bitpay/bitcore-wallet-client/badge.svg)](https://coveralls.io/r/bitpay/bitcore-wallet-client)


A client library for bitcore-wallet-service

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
