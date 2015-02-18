# bitcore-wallet-service

A Multisig HD Wallet Service, with minimun server trust.

# Quick Guide

``` bash
 # Start the server
 npm ./app.js
 
 # Try the CLI interface
 cd bit-wallet
 
 # Create a 2-2 wallet (john.dat is the file were the wallet critical data will be stored, add -t for testnet)
 ./bit -c john.dat create 2-2 john 
  * Secret to share:
  	0a18bed5-5607-4fde-a809-dc6561bc0664:L3WtafRAEHty7h2J7VCHdiyzFboAdVFnNZXMmqDGw4yiu5kW9Tp4:T
 ./bit -c join.dat status
 
 # User -h or BIT_HOST to setup the base URL for your server.
 
 # Join the wallet from other copayer
   ./bit -c pete.dat join	0a18bed5-5607-4fde-a809-dc6561bc0664:L3WtafRAEHty7h2J7VCHdiyzFboAdVFnNZXMmqDGw4yiu5kW9Tp4:T
   ./bit -c pete.dat status
   
 # Sets default file to use  
   export BIT_FILE=pete.dat
   
 # Create an address  
   ./bit address 
     [1bitcoinaddress]
   ./bit balance
   
 # Spend coins. Values always in satoshis
   ./bit send 1xxxxx 100 "100 satoshis to mother"
 
 # List pending TX Proposals
   ./bit status
   
 # Sign or reject TXs from other copayers
   ./bit -c pete.data reject <id>
   ./bit -c pete.data sign <id>
   
 # Export your critical wallet data (you need *quorum* of wallet's copayer to extract coins)
   ./bit export
   # Or export it to a QR 
   ./bit export --qr
   
 # Import it later. It can be safetly used from multiple devices.
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
 
# Security Considerations
 * Private keys are never send to the server. Copayers store them locally.
 * Extended public keys are stored on the server. This allow the server to easily check wallet's balances, send offline notifications to copayers, etc.
 * During wallet creation a wallet secret is created by the initial copayer containg a private key. Following copayers need to proof the have the secret by signing their information with it to join the wallet. The secret should be shared using secured channels.

## All server responses are verified:
  * Addresses, change addresses are derived independently and locally by the copayers from their local data.
  * TX Proposals templates are signed by copayers, and verified by others, so the server cannot create / tamper them

## Notes
 * A copayer could join the wallet more that one time, and there is not mechanism to prevent it. Copayers should use the command 'confirm' to check others copayer's identity.
##  In case the server is compromised
 * It could be possible to see past (and future) wallet's transactions.
 * It is not possible to spend wallet's funds, since private keys are never send or stored at the server
 * It is not possible to tamper tx proposal or wallet addresses since they are computed and verified by copayers
 * Copayers could switch to other server using their local data (see `recreate` command). In this case only the wallet extended data will be lost. (Decorated TX History, and some copayer metadata).


# Export Format
 Exporting a wallet will expose copayer's extended private key and other's copayers extended public keys. This information is enough to extract funds from the wallet, given the required quorum is meet.

