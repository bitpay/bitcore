#!/bin/bash

FIND='find';

##if [[ "$OSTYPE" =~ "darwin" ]] 
##then
##    FIND='gfind'
##fi


if [ -z "$1" ]
then
	echo "$0 : find functions references "
	echo "Usage $0 function_name "
	exit;
fi 

EXTRA=''


CMD="grep -rnH"

if [ "$2" != '--nocolor' ]
then
    CMD="$CMD --color=always"
fi


$FIND -L . -name \*.json -not -wholename \*node_modules\* -not -wholename \*public/lib\*  -exec $CMD "$1"  {} + \
    -o  -name \*.html -not -wholename \*node_modules\* -not -wholename \*public/lib\*  -exec $CMD "$1"  {} +  \
    -o  -name \*.jade -not -wholename \*node_modules\* -not -wholename \*public/lib\*  -exec  $CMD "$1"  {} +  \
    -o  -name \*.js  -not -wholename \*node_modules\* -not -wholename \*public/lib\* -exec  $CMD "$1"  {} + 

