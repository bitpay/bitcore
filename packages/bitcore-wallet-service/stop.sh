#!/bin/bash

stop_program ()
{
  pidfile=$1

  echo "Stopping Process - $pidfile. PID=$(cat $pidfile)"
  kill -9 $(cat $pidfile)
  rm $pidfile
  
}

stop_program pids/bws.pid
stop_program pids/fiatrateservice.pid
stop_program pids/emailservice.pid
stop_program pids/bcmonitor.pid
stop_program pids/pushnotificationsservice.pid
stop_program pids/messagebroker.pid

