# bitcore-wallet-service

A Multisig HD Wallet Service, with minimun server trust.

# Quick Guide

``` bash
 # Start the server
 npm ./app.js
 
 # Try the CLI interfase
 cd bit-wallet
 
 # Create a 2-2 wallet (john.dat is the file were the wallet critical data will be stored)

 ./bit -c john.dat create 2-2 john -n testnet
  * Secret to share:
  	0a18bed5-5607-4fde-a809-dc6561bc0664:L3WtafRAEHty7h2J7VCHdiyzFboAdVFnNZXMmqDGw4yiu5kW9Tp4:T
 ./bit -c join.dat status
 
 # Join the wallet
   ./bit -c pete.dat join	0a18bed5-5607-4fde-a809-dc6561bc0664:L3WtafRAEHty7h2J7VCHdiyzFboAdVFnNZXMmqDGw4yiu5kW9Tp4:T
   ./bit -c pete.dat status
   
   export BIT_FILE=pete.dat
   ./bit address 
     [1bitcoinaddress]
   ./bit balance
   ./bit send 1xxxxx 100 "100 satoshis to mother"
   ./bit status
   
   # Export your critical wallet data (you need *quorum* of wallet's copayer to extract coins)
   ./bit export
   # Or export it to a QR 
   ./bit export --qr
   
   # Import it later
   ./bit import <file>
   
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
 
# Security Considerations
 * Private keys are never send to the server. Copayers store them locally.
 * Extended public keys are stored on the server. This allow the server to easily check wallet's balances, send offline notifications to copayers, etc. In case the server is compromised, the attacked could see past (and future) wallet's transactions.
 * During wallet creation a wallet secret is created by the initial copayer containg a private key. Following copayers need to prof the have the secret by signing their information to join the wallet. The secret should be shared using secured channels.
 * Note that a copayer could should more that one time to the wallet, and there is not mechanism to prevent it. Copayers should use 'confirm' to check others copayer's identity.
 * All server responses are verified:
  * Addresses, change addresses are derived individually by copayers from their local data.
  * TX Proposals templates are signed by copayers, and verified by others, so the server cannot create / tamper them

# Export Format
 Exporting a wallet will expose copayer's extended private key and other's copayers extended public keys. This information is enough to extract funds from the wallet, given the required quorum is meet.

