# fullNodePlus

## Config Examples
./config.json

default:
```
{
  "network": "testnet",
  "chainSource": "bcoin"
}
```
Connect to any mainnet trusted node:
```
{
  "network": "main",
  "chainSource": "p2p",
  "p2pHost": "127.0.0.1"
}
```

## Add Wallet:

POST `/wallet`

BODY:
```
{
	"name": "WalletName"
}
```

## Get Wallet:

GET `/wallet/:walletId`

## Import Addresses:

POST `/wallet/:walletId`

BODY: raw jsonl wallet file of the form
{"address": "bItCoInAddReSSHeRe"}
...

## Get Wallet Transactions:

GET `/wallet/:walletId/transactions`

## Get Balance:

GET `/wallet/:walletId/balance`
