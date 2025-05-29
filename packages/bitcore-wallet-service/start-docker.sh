#!/bin/bash

# Run each service directly
node ./ts_build/messagebroker/messagebroker.js &
node ./ts_build/bcmonitor/bcmonitor.js &
node ./ts_build/emailservice/emailservice.js &
node ./ts_build/pushnotificationsservice/pushnotificationsservice.js &
node ./ts_build/fiatrateservice/fiatrateservice.js &
node ./ts_build/bws.js &

echo "All services started"

# Keep the script running
echo "Press Ctrl+C to stop all services"
while true; do
  sleep 60
done