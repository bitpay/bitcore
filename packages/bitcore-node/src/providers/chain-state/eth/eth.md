# Config
The following config block supports two networks for ETH. Main and Local

The local network would be geth, or testrpc
The main network shows how to connect via websocket


```

"ETH": {
  "local": {
    "chainSource": "web3",
      "provider": {
        "protocool": "http",
        "host": "127.0.0.1",
        "port": "8545"
      }
  },
    "main": {
      "chainSource": "web3",
      "provider": {
        "protocool": "wss",
        "host": "mainnet.infura.io/ws"
      }
    }
},
"BAT": {
  "main": {
    "chainSource": "web3",
    "provider": {
      "protocool": "wss",
      "host": "mainnet.infura.io/ws"
    }
  }
}
```

# Adding your own provider

Should you want to add your own provider, you can register it on the ChainStateProvider

import {ChainStateProvider} from 'src/providers/chain-state';
ChainStateProvider.registerService(myServiceThatImplementsIChainStateService); 
