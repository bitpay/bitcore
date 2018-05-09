#!/bin/bash 

cd /var/www
npm install
npm rebuild node-sass
npm install -g replace
replace '%DEFAULT_CURRENCY%' ${DEFAULT_CURRENCY} src/providers/currency/currency.ts
replace '%API_PREFIX%' ${API_PREFIX} src/providers/api/api.ts
replace '%IONIC_PATH%' ${IONIC_PATH} ionic.config.json
replace '%IONIC_PROXY_URL%' ${IONIC_PROXY_URL} ionic.config.json
npm start
