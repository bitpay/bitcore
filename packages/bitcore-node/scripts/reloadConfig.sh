#!/bin/sh

dir=$(pwd)

if [ $# = 0 ]; then
  pid_paths=$dir/pids/*

  pids=$(
    for path in $pid_paths; do
      cat $path
      printf ' '
    done
  )

  kill -USR1 $pids &&
  echo "Refreshed all workers: $pids"
  exit 0;
fi

if [ $1 = --help ]; then
  cat << EOF
Usage: $(basename "$0") [OPTIONS] [WORKER...]

Reload configuration for bitcore workers

Options:
  --help    Show this help message and exit
  list      List all running workers

Arguments:
  WORKER    Name(s) of worker(s) to reload configs (e.g., all api p2p)
            If no worker is specified, reload all running workers configs.

Examples:
  $(basename "$0")           Reload config for all workers
  $(basename "$0") api p2p   Reload config for 'api' and 'p2p' workers
  $(basename "$0") list      List all running workers
EOF
  exit 0
fi

if [ $1 = list ]; then 
  for base in $(ls $dir/pids/*); do
    basename $base .pid
  done
  exit 0
fi

for worker in $@; do
  if [ ! -f "$dir/pids/$worker.pid" ]; then
    echo "$worker is not running\n$worker.pid not found in $dir/pids"
    case $worker in
      all|api|p2p) ;;
      *)
        echo "$worker is not a standard worker\nstandard workers: all, api, p2p"
        ;;
      esac
    exit 1
  fi
done

pid_paths=$(
  for worker in $@; do
    printf "$dir/pids/$worker.pid "
  done
)

pids=$(
  for path in $pid_paths; do
    cat $path
    printf ' '
  done
)

kill -USR1 $pids &&

cat << EOF
Sent reload signal(s) SIGUSR1 to '$@'
pids: $pids 
EOF