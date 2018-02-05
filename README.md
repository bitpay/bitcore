# fullNodePlus
_Requirements_:
- Trusted P2P Peer
- MongoDB Server >= v3.4
## Config Examples
./config.json

Connect to any mainnet trusted node:
```
{
  "network": "main",
  "chainSource": "p2p",
  "trustedPeers": [
    {"host": "127.0.0.1", "port": 8333}
  ]
}
```

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

## Get Wallet Transactions:

GET `/api/wallet/:walletId/transactions`

## Get Balance:

GET `/api/wallet/:walletId/balance`
