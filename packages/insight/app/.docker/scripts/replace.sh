#!/bin/bash 

echo "current directory is $PWD"
echo "run directory is ${RUN_DIR}"
echo "running in..."
cd ${RUN_DIR}
pwd
echo "copying ionic.config.json template..."
cp .docker/templates/ionic.config.json .
npm install
npm rebuild node-sass
npm install -g replace
replace '%DEFAULT_CURRENCY%' ${DEFAULT_CURRENCY} src/providers/currency/currency.ts
replace '%API_PREFIX%' ${API_PREFIX} src/providers/api/api.ts
replace '%IONIC_PATH%' ${IONIC_PATH} ionic.config.json
replace '%IONIC_PROXY_URL%' ${IONIC_PROXY_URL} ionic.config.json
npm start
