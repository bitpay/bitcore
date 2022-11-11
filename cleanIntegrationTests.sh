#!/bin/bash

docker container stop $(docker container ls -qf name=bitcore_*)
docker container rm $(docker container ls -aqf name=bitcore_*)
docker image rm bitcore-test_runner
docker image rm bitcore-rippled
$HOME/dev/bitcore/packages/bitcore-client/bin/wallet-delete --name EthereumWallet-Ci
$HOME/dev/bitcore/packages/bitcore-client/bin/wallet-delete --name PolygonWallet-Ci
