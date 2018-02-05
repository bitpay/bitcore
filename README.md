# fullNodePlus
_Requirements_:
- Trusted P2P Peer
- MongoDB Server >= v3.4
## Config Example
./config.json

Connect to any mainnet trusted node:
```
{
  "network": "mainnet",
  "chainSource": "p2p",
  "trustedPeers": [
    {
      "host": "127.0.0.1",
      "port": 8333
    }
  ]
}
```

# Wallet

## Add Wallet:

POST `/api/wallet`

BODY:
```
{
	"name": "WalletName"
}
```

## Get Wallet:

GET `/api/wallet/:walletId`

## Import Addresses:

POST `/api/wallet/:walletId`

BODY: raw jsonl wallet file of the form
{"address": "bItCoInAddReSSHeRe"}
...

## Get Wallet Addresses

GET `/api/wallet/:walletId/addresses

## Get Wallet Transactions:

GET `/api/wallet/:walletId/transactions`

## Get Balance:

GET `/api/wallet/:walletId/balance`

## Get Wallet UTXOS

GET `/api/wallet/:walletId/utxos`

# Transactions

## Get Transactions by block

GET `/api/tx/?blockHeight=123456`

GET `/api/tx/?blockHash=0000000000002917ed80650c6174aac8dfc46f5fe36480aaef682ff6cd83c3ca`

## Get Transaction by txid

GET `/api/tx/5c8a63e695caf95c28a0155beaa22b84a7adb18b8693ba90f04d94891d122afe`

# Address

## Get Transaction Outputs by Address

GET `/api/address/mmEsgUprBEQkGDKowPQSLEYDbMtGRKxaF4/?unspent=true`

## Get Balance for an Address

GET `/api/address/mmEsgUprBEQkGDKowPQSLEYDbMtGRKxaF4/balance`

# Block

## Get Block

GET `/api/block/0000000000002917ed80650c6174aac8dfc46f5fe36480aaef682ff6cd83c3ca`

GET `/api/block/123456`
