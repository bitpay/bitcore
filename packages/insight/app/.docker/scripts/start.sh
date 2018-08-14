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
npm start
