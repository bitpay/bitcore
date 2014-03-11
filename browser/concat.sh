#! /bin/bash

cd vendor/
cat browser-adapter.js crypto.js ripemd160.js jsbn.js jsbn2.js prng4.js util.js rng.js ec.js sec.js ecdsa.js eckey.js > vendor.js
mv vendor.js ../
cd ../

