#!/bin/bash

# Create log directory
mkdir -p logs

# Run each service and redirect output to log files
node ./ts_build/src/messagebroker/messagebroker.js > logs/messagebroker.log 2>&1 &
node ./ts_build/src/bcmonitor/bcmonitor.js > logs/bcmonitor.log 2>&1 &
node ./ts_build/src/emailservice/emailservice.js > logs/emailservice.log 2>&1 &
node ./ts_build/src/pushnotificationsservice/pushnotificationsservice.js > logs/pushnotificationsservice.log 2>&1 &
node ./ts_build/src/fiatrateservice/fiatrateservice.js > logs/fiatrateservice.log 2>&1 &
node ./ts_build/src/bws.js > logs/bws.log 2>&1 &

echo "All services started"

# Keep the script running by tailing all log files in parallel
echo "Tailing logs..."
tail -f logs/messagebroker.log logs/bcmonitor.log logs/emailservice.log logs/pushnotificationsservice.log logs/fiatrateservice.log logs/bws.log