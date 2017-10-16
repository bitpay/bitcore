#!/bin/bash
set -e

############# variables ################

user=`whoami`
process=false

########################################

# deploys latest bitcore to application servers over ssh

if [ -z "${1}" ]; then
  echo 'no server file given, exiting.'
  exit 1
fi

green="\033[38;5;40m"
magenta="\033[38;5;200m"
lightGreen="\033[38;5;112m"
white="\033[38;5;231m"
mustard="\033[38;5;214m"
grey="\033[38;5;7m"
reset="\033[0m"
ssh="ssh -tt -l${user} -p"



function execCmd() {
  echo -e ${green}$cmd${reset}
  echo "-------------------------------------------------"
  if [ "${process}" = true ]; then
    eval "${sshCmd}\"${cmd}\""
  fi
}

function deploy () {

  # stop the server
  cmd="sudo service bitcored stop"
  execCmd

  # run npm install -g bitcore@beta
  cmd="sudo su - bitcore -c 'npm install -g bitcore@beta'"
  execCmd

  # start server
  cmd="sudo service bitcored start"
  execCmd

}


function monitor () {

  eval "${sshCmd}\"${logCmd}\"" &

}

function closeout () {

  PGID=$(ps -o pgid= $$ | grep -o [0-9]*)
  kill -- -$PGID
  exit 0

}

trap "closeout" SIGINT SIGTERM

while IFS='' read -r server || [[ -n "$server" ]]; do
  if [[ "${server}" =~ ^\s*# ]]; then
    continue
  fi

  echo "deploying to: $server"

  IFS=':' read -ra url <<< "${server}"

  port="${url[1]}"
  host="${url[0]}"
  logType="${url[2]}"

  if [ -z "${port}" ]; then
    port=22
  fi

  if [ -z "${logType}" ]; then
    logCmd="sudo journalctl -f"
  else
    logCmd="sudo tail -f /var/log/upstart/bitcored_testnet_new.log"
  fi

  sshCmd="${ssh}${port} ${host} "

  monitor
  deploy

  sleep 10
done < "$1"

sleep 240
closeout
