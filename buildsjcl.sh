#!/bin/bash
cd node_modules/sjcl && ./configure --without-all --with-aes --with-convenience --with-cbc --with-codecHex --with-codecBase64 --with-sha512 --with-hmac && make && cd ../.. && cp node_modules/sjcl/sjcl.js lib/
