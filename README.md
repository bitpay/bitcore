# bitcore-wallet

A simple Command Line Interface Wallet using [Bitcore Wallet Service] (https://github.com/bitpay/bitcore-wallet-service) and its *official* client lib, bitcore-wallet-client] (https://github.com/bitpay/bitcore-wallet-client)


# Quick Guide

``` shell
 # Use -h or BIT_HOST to setup the BWS URL (defaults to localhost:3001)
 # 
 # Start a local BWS instance be doing:
 # git clone https://github.com/bitpay/bitcore-wallet-service.git bws
 # cd bws; npm install; npm start

 cd bin
 
 # Create a 2-of-2 wallet (.bit.dat is the default filename (saved on HOME ) where the wallet critical data will be stored)
 #
 # TIP: add -t for testnet
  wallet create john 2-2 
  * Secret to share:
    JevjEwaaxW6gdAZjqgWcimL525DR8zQsAXf4cscWDa8u1qKTN5eFGSFssuSvT1WySu4YYLYMUPT

  wallet status
 
 # Use -f or BIT_FILE to setup the wallet data file
 
 # Join the wallet from other copayer
   wallet -f pete.dat join JevjEwaaxW6gdAZjqgWcimL525DR8zQsAXf4cscWDa8u1qKTN5eFGSFssuSvT1WySu4YYLYMUPT
   
   export BIT_FILE=pete.dat
   wallet -f pete.dat status

 # Generate addresses to receive money
   wallet address
   * New Address 3xxxxxx

 # Check your balance
   wallet balance
   
 # Spend coins. Amount can be specified in btc, bit or sat (default)
   wallet send 1xxxxx 100bit "100 bits to mother"

 # You can use 100bit or 0.00001btc or 10000sat.  (Set BIT_UNIT to btc/sat/bit to select output unit).

 # List pending TX Proposals
   wallet txproposals
   
 # Sign or reject TXs from other copayers
   wallet -f pete.dat reject <id>
   wallet -f pete.dat sign <id>

 # List transaction history
   a few minutes ago: => sent 100 bit ["100 bits to mother" by pete] (1 confirmations)
   a day ago: <= received 1,400 bit (48 confirmations)
   a day ago: <= received 300 bit (52 confirmations)
   
 # List all commands:
   wallet --help
 
    
  ```
  
  
# Password protection 

Currently there is no password protection. This feature will be available soon.
 


# Airgapped Operation 

[TODO]

Air gapped (non connected) devices are supported. This setup can be useful if maximum security is needed, to prevent private keys from being compromised. In this setup, a device is installed without network access, and transactions are signed off-line. Transactions can be pulled from BWS using a `proxy` device, then downloaded to a pendrive to be moved to the air-gapped device, signed there, and then moved back the `proxy` device to be sent back to BWS. Note that Private keys are generated off-line in the airgapped device.


``` shell

# On the Air-gapped device
airgapped$ wallet genkey
airgapped$ wallet export -o toProxy  --access readwrite  #(or --readonly if proxy won't be allowed to propose transactions)

# On the proxy machine
proxy$ wallet import toProxy
proxy$ wallet join secret      # Or wallet create 
proxy$ wallet address          # Only if readwrite access was granted
proxy$ wallet balance

# Export pending transaction to be signed offline
proxy$ wallet txproposals -o txproposals.dat

## Back to air-gapped device

# Check tx proposals:
airgapped$  wallet txproposals -i txproposals.dat

# First time txproposals is running on the air gapped devices, the public keys of the copayers will be imported from the txproposals archive. That information is exported automatically by the proxy machine, and encrypted copayer's xpriv derivatives.

# Sign them
airgapped$  wallet sign  -i txproposals.dat -o txproposals-signed.dat

## Back to proxy machine

# Send signatures to BWS
proxy$  wallet sign -i txproposals-signed.dat
```


