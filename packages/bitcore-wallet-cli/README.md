# bitcore-wallet-service


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
   
   # List all commands:
    ./bit --help
  ```
