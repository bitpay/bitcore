# fullNodePlus

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
