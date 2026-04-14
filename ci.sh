#!/bin/bash

# NOTE: The CI used to use this but it doesn't anymore because the CI pipeline started timing out. We moved most of the CI pipeline logic to the .circleci/config.yml file
#       This is still useful for local testing, though.

for arg in "$@"; do
  if [ "$arg" == "--help" ] || [ "$arg" == "-h" ]; then
    echo "Usage: $0 <build|local|down> [build: ci|local | local: <command>|chains]"
    echo "  build: Builds the Docker images. Optionally specify 'ci' or 'local' to build with the respective docker-compose files (defaults to 'ci')."
    echo "  local: Runs a command in the test_runner container using the local docker-compose configuration. The second argument is the command to run."
    echo "  down: Shuts down the local test environment and removes volumes."
    echo ""
    echo "Examples:"
    echo "  $0 build ci                           # Builds the Docker images for CI environment"
    echo "  $0 build local                        # Builds the Docker images for local environment"
    echo "  $0 local 'npm run ci:bitcore-node'    # Runs 'npm run ci:bitcore-node' in the test_runner container using local configuration"
    echo "  $0 local chains                       # Starts the local test environment with all chains"
    echo "  $0 down                               # Shuts down the local test environment and removes volumes"
    exit 0
  fi
done

if [ "$1" == "build" ]; then
  env="$2"
  if [ -z $2 ]; then
    env="ci"
  fi
  if [ "$env" = "ci" ]; then
    docker-compose -f docker-compose.test.base.yml -f docker-compose.test.$env.yml build
  elif [ "$env" = "local" ]; then
    docker compose -f docker-compose.test.base.yml -f docker-compose.test.$env.yml build
  else
    echo "Unknown environment '$env'. Expected 'ci' or 'local'."
  fi
elif [ "$1" = "local" ]; then
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
