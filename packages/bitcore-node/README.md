Bitcore Node
============
_Requirements_:
- Trusted P2P Peer
- MongoDB Server >= v3.4

Checkout the repo

```
git clone git@github.com:bitpay/bitcore.git
git checkout v8.0.0
npm install
```

Set up your bitcore.config.json file in ./bitcore

## Example bitcore.config.json

bitcore.config.json file in ./bitcore

```
{
  "bitcoreNode": {
    "chains": {
      "BTC": {
        "mainnet": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 20008
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 20009,
            "username": "username",
            "password": "password"
          }
        },
        "regtest": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 20020
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 20021,
            "username": "username",
            "password": "password"
          }
        }
      },
      "BCH": {
        "mainnet": {
          "parentChain": "BTC",
          "forkHeight": 478558,
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 30008
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 30009,
            "username": "username",
            "password": "password"
          }
        },
        "regtest": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 30020
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 30021,
            "username": "username",
            "password": "password"
          }
        }
      }
    }
  }
}
```

Then start the node
```
npm run node
```

# API Documentation

# Transactions

## Get Transactions by block

GET `/api/BTC/mainnet/tx/?blockHeight=123456`

GET `/api/BTC/mainnet/tx/?blockHash=0000000000002917ed80650c6174aac8dfc46f5fe36480aaef682ff6cd83c3ca`

## Get Transaction by txid

GET `/api/BTC/mainnet/tx/5c8a63e695caf95c28a0155beaa22b84a7adb18b8693ba90f04d94891d122afe`

# Address

## Get Transaction Outputs by Address

GET `/api/BTC/mainnet/address/mmEsgUprBEQkGDKowPQSLEYDbMtGRKxaF4/?unspent=true`

## Get Balance for an Address

GET `/api/BTC/mainnet/address/mmEsgUprBEQkGDKowPQSLEYDbMtGRKxaF4/balance`

# Block

## Get Block

GET `/api/BTC/mainnet/block/0000000000002917ed80650c6174aac8dfc46f5fe36480aaef682ff6cd83c3ca`

GET `/api/BTC/mainnet/block/123456`


# Authenticated Methods
## Wallet

### Add Wallet:

POST `/api/BTC/mainnet/wallet`

BODY:
```
{
  "name": "WalletName",
  "chain": "BTC",
  "network": "mainnet",
  "pubKey": "03bdb94afdc7e5c4811bf9b160ac475b82156ea42c8659c8358b68c828df9a1c3d",
  "path": "m/44'/0'/0'"
}
```

### Get Wallet:

GET `/api/BTC/mainnet/wallet/:pubKey`

### Import Addresses:

POST `/api/BTC/mainnet/wallet/:pubKey`

BODY: raw jsonl wallet file of the form
```
{"address": "bItCoInAddReSSHeRe"}
```

### Get Wallet Addresses

GET `/api/BTC/mainnet/wallet/:pubKey/addresses`

### Get Wallet Transactions:

GET `/api/BTC/mainnet/wallet/:pubKey/transactions`

### Get Balance:

GET `/api/BTC/mainnet/wallet/:pubKey/balance`

### Get Wallet UTXOS

GET `/api/BTC/mainnet/wallet/:pubKey/utxos`

