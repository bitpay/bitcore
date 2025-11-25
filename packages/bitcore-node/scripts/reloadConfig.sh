pid_path=`pwd`/pids/$1\.pid
pid=`cat $pid_path`

echo sending reload signal \(SIGUSR1\) to \'$1\' with pid $pid from $pid_path

kill -s SIGUSR1 $pid