# Installing 
```
npm install
```

# Running Bitcore-Node

To run bitcore-node you'll need
* mongoDB v3.4.11
* node 8.9.4
* a valid bitcore.config.json
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


# Configuring Bitcore Services
Bitcore services can be configured through a bitcore.config.json file

Each service should have it's own namespace in the config

Eg:

```
{
  bitcoreNode : {},
  insight: {},
  someOtherService: {}
}
```

## Bitcore-Node Config
Bitcore-Node can access a bitcore.config.json file from 
* Environment Variable
  * $BITCORE_CONFIG_PATH=some/path/to/config
* node arguments
  * --config some/path/to/config
* ~/bitcore.config.json
* ${BITCORE_DIR}/bitcore.config.json
* ${BITCORE_DIR}/packages/bitcore-node/bitcore.config.json

### Example Config
```
{
  "bitcoreNode": {
    "pruneSpentScripts": true,
    "chains": {
      "BTC": {
        "regtest": {
          "chainSource": "p2p",
          "trustedPeers": [
            {
              "host": "127.0.0.1",
              "port": 30000
            }
          ],
          "rpc": {
            "host": "127.0.0.1",
            "port": 30001,
            "username": "bitpaytest",
            "password": "local321"
          }
        }
      }
    }
  }
}
```


### Trusted Peer Environment Variables
Trusted peers can also be added via enviroment variables.
```
TRUSTED_BTC_REGTEST_PEER=127.0.0.1
TRUSTED_BTC_REGTEST_PEER_PORT=30000
```
This would accomplish the same thing as adding a peer to the trustedPeers array in the config


# Bitcore Wallet

Create a wallet
```
./bin/wallet-create "testing wallet creation" 1-1 --coin btc --network testnet -f ~/newtestwallet.dat
```

Register a wallet
```
./bin/wallet-import 
```
