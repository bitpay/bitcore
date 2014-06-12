#! /bin/bash

# run mocha until it fails

COUNTER=0
mocha
while [  $? -eq 0 ]; do
  mocha
done
