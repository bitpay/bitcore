#!/bin/bash

# Grab the node root certs. This will be our trusted certs file.

# wget https://raw.githubusercontent.com/joyent/node/master/tools/certdata.txt

wget https://raw.githubusercontent.com/joyent/node/master/src/node_root_certs.h \
  || curl -OJ https://raw.githubusercontent.com/joyent/node/master/src/node_root_certs.h

mv node_root_certs.h lib/browser/Trusted.js
pushd lib/browser &> /dev/null

sed -i '$s/,$//g' Trusted.js

echo "module.exports = ["$'\n'"$(cat Trusted.js)" > Trusted.js
echo "];" >> Trusted.js

sed -i 's/^"/+ "/g' Trusted.js
sed -i 's/^+ "-----B/"-----B/g' Trusted.js

popd &> /dev/null
