#!/bin/bash

for arg in "$@"; do
  if [ "$arg" == "--help" ] || [ "$arg" == "-h" ]; then
    echo "Usage: $0 <build|run|down> [build | run: <command>|chains]"
    echo "  build: Builds the Docker images."
    echo "  run \<command\>: Runs all blockchains OR a command in the test_runner container using the local docker-compose configuration."
    echo "  down: Shuts down containers and removes volumes."
    echo ""
    echo "Examples:"
    echo "  $0 build                              # Builds the Docker images for local environment"
    echo "  $0 run 'npm run ci:bitcore-node'      # Runs 'npm run ci:bitcore-node' in the test_runner container using local configuration"
    echo "  $0 run chains                         # Starts all blockchains needed for testing"
    echo "  $0 down                               # Shuts down containers and removes volumes"
    exit 0
  fi
done

if [ "$1" == "build" ]; then
  docker compose -f docker-compose.test.base.yml -f docker-compose.test.local.yml build
elif [ "$1" = "run" ]; then
  node bitcore-test.config.js
  if [ "$2" = "chains" ]; then
    docker compose -f docker-compose.test.base.yml -f docker-compose.test.ci.yml up -d
  else
    docker compose -f docker-compose.test.base.yml -f docker-compose.test.local.yml run --entrypoint "$2" test_runner
  fi
elif [ "$1" = "down" ]; then
  docker compose -f docker-compose.test.base.yml -f docker-compose.test.local.yml down -v
  docker container rm $(docker container ls -qa --filter name=bitcore-test_runner-run-*) &>/dev/null
  docker rmi bitcore-test_runner:latest
else
  echo "Missing expected parameter. The first parameter should be 'build', 'local', or 'down'."
fi
