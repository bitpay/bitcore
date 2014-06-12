#! /bin/bash

# run mocha until it fails

COUNTER=0
mocha
while [  $? -ne 0 ]; do
  mocha
done
