# Installing 
```
npm install
```

# Running Bitcore-Node

To run bitcore-node you'll need
* mongoDB v3.4.11
* node 8.9.4
* a valid config.json
  * see bitcore-node/README

Alternatively, if you have docker

```
npm run build
docker-compose up
```

# Services
* bitcore-node
  * port 3000
* insight
  * port 8100


# Bitcore Wallet

Create a wallet
```
./bin/wallet-create "testing wallet creation" 1-1 --coin btc --network testnet -f ~/newtestwallet.dat
```

Register a wallet
```
./bin/wallet-import 
```
