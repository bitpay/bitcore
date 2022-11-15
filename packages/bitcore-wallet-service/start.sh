#!/bin/bash

mkdir -p logs
mkdir -p pids

# run_program (nodefile, pidfile, logfile)
run_program ()
{
  nodefile=$1
  pidfile=$2
  logfile=$3

  if [ -e "$pidfile" ]
  then
    echo "$nodefile is already running. Run 'npm stop' if you wish to restart."
    return 0
  fi

  nohup node $nodefile >> $logfile 2>&1 &
  PID=$!
  if [ $? -eq 0 ]
  then
    echo "Successfully started $nodefile. PID=$PID. Logs are at $logfile"
    echo $PID > $pidfile
    return 0
  else
    echo "Could not start $nodefile - check logs at $logfile"
    exit 1
  fi
}

run_program ./ts_build/messagebroker/messagebroker.js pids/messagebroker.pid logs/messagebroker.log
run_program ./ts_build/bcmonitor/bcmonitor.js pids/bcmonitor.pid logs/bcmonitor.log
run_program ./ts_build/emailservice/emailservice.js pids/emailservice.pid logs/emailservice.log
run_program ./ts_build/pushnotificationsservice/pushnotificationsservice.js pids/pushnotificationsservice.pid logs/pushnotificationsservice.log
run_program ./ts_build/fiatrateservice/fiatrateservice.js pids/fiatrateservice.pid logs/fiatrateservice.log
run_program ./ts_build/bws.js pids/bws.pid logs/bws.log

