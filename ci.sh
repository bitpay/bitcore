#!/bin/bash
docker-compose -f docker-compose.test.yml run --entrypoint "$1" test_runner

