#! /bin/bash

cd vendor/
cat browser-adapter.js crypto-2.0.js crypto-3.1.js jsbn.js jsbn2.js prng4.js util.js rng.js ec.js sec.js ecdsa.js eckey.js > vendor-bundle.js
mv vendor-bundle.js ../
cd ../

