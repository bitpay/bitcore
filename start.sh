#!/bin/bash
NODE_ENV='production' INSIGHT_NETWORK='livenet' ./node_modules/pm2/bin/pm2 -f start insight.js --name insight-livenet &
sleep 10;
NODE_ENV='production' INSIGHT_NETWORK='testnet' ./node_modules/pm2/bin/pm2 -f start insight.js --name insight-testnet &

