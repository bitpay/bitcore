# bitcore-wallet-service


[![Build Status](https://img.shields.io/travis/bitpay/bitcore-wallet-service.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-wallet-service)
[![Coverage Status](https://coveralls.io/repos/bitpay/bitcore-wallet-service/badge.svg)](https://coveralls.io/r/bitpay/bitcore-wallet-service)


A Multisig HD Wallet Service, with minimun server trust.

# Quick Guide

``` bash
 # Start the server
 npm ./app.js
 
 # Try the CLI interface
 cd bit-wallet
 
 # Create a 2-of-2 wallet (john.dat is the file where the wallet critical data will be stored, add -t for testnet)
 ./bit -f john.dat create 2-2 john 
  * Secret to share:
    0a18bed5-5607-4fde-a809-dc6561bc0664:L3WtafRAEHty7h2J7VCHdiyzFboAdVFnNZXMmqDGw4yiu5kW9Tp4:T
 ./bit -f join.dat status
 
 # Use -h or BIT_HOST to setup the base URL for your server.
 
 # Join the wallet from other copayer
   ./bit -f pete.dat join 0a18bed5-5607-4fde-a809-dc6561bc0664:L3WtafRAEHty7h2J7VCHdiyzFboAdVFnNZXMmqDGw4yiu5kW9Tp4:T
   ./bit -f pete.dat status
   
 # Set default file to use  
   export BIT_FILE=pete.dat
   ./bit address 
     [1bitcoinaddress]
   ./bit balance
   
 # Spend coins. Amount can be specified in btc, bit or sat (default)
   ./bit send 1xxxxx 100bit "100 bits to mother"
 
 # List pending TX Proposals
   ./bit status
   
 # Sign or reject TXs from other copayers
   ./bit -f pete.data reject <id>
   ./bit -f pete.data sign <id>
   
 # Export your critical wallet data (you need *quorum* of wallet's copayer to extract coins)
   ./bit export
   # Or export it to a QR 
   ./bit export --qr
   
 # Import it later. It can be safely used from multiple devices.
   ./bit import <file>
   
 # In case you use a new server, recreate the wallet from our local information
   ./bit recreate 
   
   # List all commands:
    ./bit --help
    
    
  ```
  
# Server API

## create a wallet
 POST  `/v1/wallets`
## join a wallet
 POST  `/v1/wallets/:id/copayers`

 ...

 [To be completed, see app.js]
 
# Local  data

Copayers store its extended private key and their copayer's extended public key locally. We call this the ``Wallet Critical Data``. 

# Security Considerations
 * Private keys are never send to the server. Copayers store them locally.
 * Extended public keys are stored on the server. This allows the server to easily check wallet balance, send offline notifications to copayers, etc.
 * During wallet creation a wallet secret is created by the initial copayer containg a private key. All copayers need to prove they have the secret by signing their information with this private key when joining the wallet. The secret should be shared using secured channels.

## All server responses are verified:
  * Addresses, change addresses are derived independently and locally by the copayers from their local data.
  * TX Proposals templates are signed by copayers, and verified by others, so the server cannot create / tamper them

## Notes
 * A copayer could join the wallet more than once, and there is no mechanism to prevent it. Copayers should use the command 'confirm' to check other copayer's identity.

##  In case the server is compromised
 * It could be possible to see past (and future) wallet's transactions.
 * It is not possible to spend wallet funds, since private keys are never sent nor stored at the server
 * It is not possible to tamper tx proposals or wallet addresses since they are computed and verified by copayers
 * Copayers could switch to another server using their local data (see `recreate` command). In this case only the wallet extended data will be lost (pending and past transaction proposals, some copayer metadata).

# Export Format
 Exporting a wallet will expose copayer's extended private key and other copayer's extended public keys. This information is enough to extract funds from the wallet, given the required quorum is met.
 
 The format is:
 ``` json
 [ "(copayer extended private key)", 
 "required signature", 
 "(array of other copayers extended public keys, excluding own)"]
 ```
 Example, of a 1-of-2 wallet:
 ``` json
  [
  "tprv8ZgxMBicQKsPds3YbNWdCcsvxhnpjEecCJv1pBPCLEekwhwWNqpRwA283ASepgTnwAXhu4vZPeRAiX1CpPcjcY6izWSC3NVqyk1gWhF8xWy",
  1,
  ["tpubD6NzVbkrYhZ4Y1DE1F6s4NWbLjwQSReggiksexkJ7R7p4tCKH1vmu7G9TafmkGs252PMrs5j6xz7uSiDLbUsE43eHbRa5wCauXqhJnhN9MB"]
  ]
```

