# bitcore-wallet

A simple Command Line Interfase Wallet using [Bitcore Wallet Service] (https://github.com/bitpay/bitcore-wallet-service) and its *official* client lib, pbitcore-wallet-client] (https://github.com/bitpay/bitcore-wallet-client)


# Quick Guide

``` shell
 # Use -h or BIT_HOST to setup the BWS URL (defaults to localhost:3001)

 cd bin
 
 # Create a 2-of-2 wallet (john.dat is the file where the wallet critical data will be stored, add -t for testnet)
 ./bit  create 2-2 john 
  * Secret to share:
    JevjEwaaxW6gdAZjqgWcimL525DR8zQsAXf4cscWDa8u1qKTN5eFGSFssuSvT1WySu4YYLYMUPT
 ./bit  status
 
 # Use -f or BIT_FILE to setup the wallet data file
 
 # Join the wallet from other copayer
   ./bit -f pete.dat join JevjEwaaxW6gdAZjqgWcimL525DR8zQsAXf4cscWDa8u1qKTN5eFGSFssuSvT1WySu4YYLYMUPT
   
   export BIT_FILE=pete.dat
   ./bit -f pete.dat status

 # Generate addresses to receive money
   ./bit address
   * New Address 3xxxxxx

 # Check your balance
   ./bit balance
   
 # Spend coins. Amount can be specified in btc, bit or sat (default)
   ./bit send 1xxxxx 100bit "100 bits to mother"

 # You can use 100bit or 0.00001btc or 10000sat.  (Set BIT_UNIT to btc/sat/bit to select output unit).

 # List pending TX Proposals
   ./bit status
   
 # Sign or reject TXs from other copayers
   ./bit -f pete.dat reject <id>
   ./bit -f pete.dat sign <id>

 # List transaction history
   a few minutes ago: => sent 100 bit ["100 bits to mother" by pete] (1 confirmations)
   a day ago: <= received 1,400 bit (48 confirmations)
   a day ago: <= received 300 bit (52 confirmations)
   
 # List all commands:
  ./bit --help
 
    
  ```
  
  
# Password protection 

Local data can be encrypted by the bit-wallet. Use the `-n` parameter to define the access level permited for no password operation. Available access levels are: `none` (password is required for everything, localfile is fully encrypted) `readonly`, `readwrite` and `full` (password is not ever required, local file is fully unencrypted) .

``` shell
# encrypts everything by default
bit create myWallet 2-3 --nopasswd none  
Password:

# allows readonly operations without password (encrypts xpriv, and leave readonlySigningKey unencrypted)
bit create myWallet 2-3 -p --nopasswd readonly

# allows readwrite operations without password (only encrypts xpriv)
bit create myWallet 2-3 -p --nopasswd readwrite
```
 

# Advanced Operation

## Mobility
You can safely access a wallet from different devices. Just copy the wallet file (`bit.dat` by default). If you need to reduce the file to the minimum (for example to fit it on a QR) or change its access level (by removing certain data on it), see `export` in the following section.

## Export, with different access levels
It is possible to export a wallet with restricted access level. The levels are:
```
    readonly : allows to read wallet data: balance, tx proposals 
    readwrite: + allows to create addresses and unsigned tx prposals 
    full     : + allows sign tx prposals 
```
`readonly` will only export the Wallet's Extended PublicKeys, and only the derived private key required for signing 'GET' request (readonly) to BWS. `readwrite` will add the derived private key required for signing all other requests (as POST) so readwrite access will be possible. And `full` will export also the Extended Private Key, which is necesary for signing wallet's transactions.  `bit import` can handle any for the levels correctly.


``` shell
# full access
bit export -o wallet.dat
# readonly access 
bit export -o wallet.dat --access readonly
# readwrite access (can create addresses, propose transactions, reject TX, but does not have signing keys)

# Import the wallet , with giveng access level
bit import wallet.dat

# Export also support QR output:
bit export --qr
```

## If the wallet needs to be migrated to another BWS instance, after importing the wallet, use the `bit-recreate` command 

## Export / Import with a new given password (TO Be Done)
``` shell
bit export -o output.dat -e
bit import output.dat 
```


# Airgapped Operation 


## WARNING: THIS IS STILL WIP ##

Air gapped (non connected) devices are supported. This setup can be useful if maximum security is needed, to prevent private keys from being compromised. In this setup, a device is installed without network access, and transactions are signed off-line. Transactions can be pulled from BWS using a `proxy` device, then downloaded to a pendrive to be moved to the air-gapped device, signed there, and then moved back the `proxy` device to be sent back to BWS. Note that Private keys are generated off-line in the airgapped device.


``` shell

# On the Air-gapped device
airgapped$ bit genkey
airgapped$ bit export -o toProxy  --access readwrite  #(or --readonly if proxy won't be allowed to propose transactions)

# On the proxy machine
proxy$ bit import toProxy
proxy$ bit join secret      # Or bit create 
proxy$ bit address          # Only if readwrite access was granted
proxy$ bit balance

# Export pending transaction to be signed offline
proxy$ bit txproposals -o txproposals.dat

## Back to air-gapped device

# Check tx proposals:
airgapped$  bit txproposals -i txproposals.dat

# First time txproposals is running on the air gapped devices, the public keys of the copayers will be imported from the txproposals archive. That information is exported automatically by the proxy machine, and encrypted copayer's xpriv derivatives.

# Sign them
airgapped$  bit sign  -i txproposals.dat -o txproposals-signed.dat

## Back to proxy machine

# Send signatures to BWS
proxy$  bit sign -i txproposals-signed.dat
```

# Security Considerations
