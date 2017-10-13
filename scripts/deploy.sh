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
reset="\033[0m"
ssh="ssh -l${user} -p"

function execCmd() {
  echo -e ${green}$cmd${reset}
  echo "-------------------------------------------------"
  if [ "${process}" = true ]; then
    eval "${sshCmd}\"${cmd}\""
  fi
}

function deploy () {

  # start a subshell to monitor the logs
  ( eval "${sshCmd}\"${logCmd}\"" ) &
  child=$!

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



while IFS='' read -r server || [[ -n "$server" ]]; do
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
    logCmd="sudo tail -f /var/log/upstart/bitcored*"
  fi
  sshCmd="${ssh}${port} ${host} "
  deploy
done < "$1"

wait "${child}"
