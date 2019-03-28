# Config

The following config block supports two networks for ETH. Main and Local

The local network would be geth, or testrpc
<<<<<<< HEAD
The main network shows how to connect via websocket

```
=======

The main network shows how to connect via websocket
>>>>>>> a613a85ad8bcf51e84e8c6cc729877f66dfaeb4b

```json
"ETH": {
  "local": {
    "chainSource": "web3",
      "provider": {
        "protocol": "http",
        "host": "127.0.0.1",
        "port": "8545"
      }
  },
    "main": {
      "chainSource": "web3",
      "provider": {
        "protocol": "wss",
        "host": "mainnet.infura.io/ws"
      }
    }
},
"BAT": {
  "main": {
    "chainSource": "web3",
    "provider": {
      "protocol": "wss",
      "host": "mainnet.infura.io/ws"
    }
  }
}
```

## Adding your own provider

Should you want to add your own provider, you can register it on the ChainStateProvider

import {ChainStateProvider} from 'src/providers/chain-state';
ChainStateProvider.registerService(myServiceThatImplementsIChainStateService);
