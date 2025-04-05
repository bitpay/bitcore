#!/bin/bash

# NOTE: The CI used to use this but it doesn't anymore because the CI pipeline started timing out. We moved most of the CI pipeline logic to the .circleci/config.yml file
#       This is still useful for local testing, though.

if [ "$1" == "build" ]; then
  env="$2"
  if [ -z $2 ]; then
    env="ci"
  fi
  docker-compose -f docker-compose.test.base.yml -f docker-compose.test.$env.yml build
elif [ "$1" != "" ]; then
  docker-compose -f docker-compose.test.base.yml -f docker-compose.test.local.yml run --entrypoint "$1" test_runner
else
  echo "Missing expected parameter. The first parameter should be 'build' or a top level npm script to run in the test_runner docker container."
fi

