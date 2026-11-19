#!/bin/bash

# Create log directory
mkdir -p logs

# Run each service and redirect output to log files
node ./ts_build/src/messagebroker/messagebroker.js > logs/messagebroker.log 2>&1 &
node ./ts_build/src/bcmonitor/bcmonitor.js > logs/bcmonitor.log 2>&1 &
node ./ts_build/src/emailservice/emailservice.js > logs/emailservice.log 2>&1 &
node ./ts_build/src/pushnotificationsservice/pushnotificationsservice.js > logs/pushnotificationsservice.log 2>&1 &
node ./ts_build/src/fiatrateservice/fiatrateservice.js > logs/fiatrateservice.log 2>&1 &

echo "Starting BWS"

# Keep supporting service logs visible without keeping the container alive.
tail -f logs/messagebroker.log logs/bcmonitor.log logs/emailservice.log logs/pushnotificationsservice.log logs/fiatrateservice.log &

# BWS owns the container's exit status and logs directly to stdout/stderr.
exec node ./ts_build/src/bws.js
