#!/bin/bash

# Grab the node root certs. This will be our trusted certs file.

# Mozilla Root Certs
# https://www.mozilla.org/en-US/about/governance/policies/security-group/certs/included/
# http://mxr.mozilla.org/mozilla-central/source/security/nss/lib/ckfw/builtins/certdata.txt?raw=1
# https://raw.githubusercontent.com/joyent/node/master/tools/certdata.txt

wget https://raw.githubusercontent.com/joyent/node/master/src/node_root_certs.h \
  || wget 'http://mxr.mozilla.org/mozilla-central/source/security/nss/lib/ckfw/builtins/certdata.txt?raw=1' \
  || curl -OJ https://raw.githubusercontent.com/joyent/node/master/src/node_root_certs.h \
  || curl -OJ 'http://mxr.mozilla.org/mozilla-central/source/security/nss/lib/ckfw/builtins/certdata.txt?raw=1'

mv node_root_certs.h lib/RootCerts.js
pushd lib &> /dev/null

sed -i '$s/,$//g' RootCerts.js

echo "var RootCerts = ["$'\n'"$(cat RootCerts.js)" > RootCerts.js
echo "];" >> RootCerts.js

sed -i 's/^"/+ "/g' RootCerts.js
sed -i 's/^+ "-----B/"-----B/g' RootCerts.js

cat <<EOF > RootCerts.js
// Use hash table for efficiency:
RootCerts = RootCerts.reduce(function(trusted, cert) {
  cert = cert.replace(/\s+/g, '');
  trusted[cert] = true;
  return trusted;
}, {});
module.exports = RootCerts;
EOF

popd &> /dev/null
