#!/bin/bash

lintPackages="bitcore-cli bitcore-client bitcore-logging bitcore-node bitcore-wallet-client bitcore-wallet-service crypto-rpc crypto-wallet-core"

lintDirs=""
for package in $lintPackages; do
  for dir in src test scripts lib; do
    if [ -d "packages/$package/$dir" ]; then
      lintDirs+="packages/$package/$dir "
    fi
  done
done

# staged JavaScript/TypeScript files that are either modified or new, not deleted files
modifiedFiles=`git diff --name-only --diff-filter=AM --cached $lintDirs | grep -E '\.(js|ts)'`

if [[ "" != $modifiedFiles ]]; then
  npx eslint $modifiedFiles
fi
