#!/bin/bash
set -e

######### Adjust these variables as needed ################

insightApiDir="${HOME}/source/insight-api"
insightUIDir="${HOME}/source/insight-ui"
bitcoreDir="${HOME}/source/bitcore"
bitcoreNodeDir="${HOME}/source/zzbitcore_node"

###########################################################

# given a string tag, make signed commits, push to relevant repos, create signed tags and publish to npm

bump_version () {
  sed -i '' -e "s/\"version\"\: .*$/\"version\"\: \"${shortTag}\",/g" package.json
}

set_deps () {
  sed -i '' -e "s/\"bitcore-node\"\: .*$/\"bitcore-node\"\: \"${shortTag}\",/g" package.json
  sed -i '' -e "s/\"insight-api\"\: .*$/\"insight-api\"\: \"${shortTag}\",/g" package.json
  sed -i '' -e "s/\"insight-ui\"\: .*$/\"insight-ui\"\: \"${shortTag}\"/g" package.json
}

tag="${1}"
shortTag=`echo "${tag}" | cut -c 2-`

if [ -z "${tag}" ]; then
  echo ""
  echo "No tag given, exiting."
  exit 1
fi

echo ""
echo "Tagging with ${tag}..."

echo "Assuming projects at ${HOME}/source..."

#############################################
# bitcore-node
#############################################

echo ""
echo "Starting with bitcore-node..."
sleep 2
pushd "${bitcoreNodeDir}"

bump_version
npm install

git add .
git diff --staged
echo ""
echo -n 'Resume?: (Y/n): '

read ans

if [ "${ans}" == 'n' ]; then
  echo "Exiting as requested."
  exit 0
fi

echo ""
echo "Committing changes for bitcore-node..."
sleep 2
git commit -S

echo ""
echo "Pushing changes to Github..."
git push origin master && git push upstream master

echo ""
echo "Signing a tag"
git tag -s "${tag}" -m"${tag}"


echo ""
echo "Pushing the tag to upstream..."
git push upstream "${tag}"

echo ""
echo "Publishing to npm..."
npm publish --tag beta

popd

#############################################
# insight-api
#############################################

echo ""
echo "Releasing insight-api..."
sleep 2
pushd "${insightApiDir}"

bump_version
npm install

git add .
git diff --staged
echo ""
echo -n 'Resume?: (Y/n): '

read ans

if [ "${ans}" == 'n' ]; then
  echo "Exiting as requested."
  exit 0
fi

echo ""
echo "Committing changes for insight-api..."
sleep 2
git commit -S

echo ""
echo "Pushing changes to Github..."
git push origin master && git push upstream master

echo ""
echo "Signing a tag"
git tag -s "${tag}" -m"${tag}"


echo ""
echo "Pushing the tag to upstream..."
git push upstream "${tag}"

echo ""
echo "Publishing to npm..."
npm publish --tag beta

popd

#############################################
# insight-ui
#############################################

echo ""
echo "Releasing insight-ui..."
sleep 2
pushd "${insightUIDir}"

bump_version
npm install

git add .
git diff --staged
echo ""
echo -n 'Resume?: (Y/n): '

read ans

if [ "${ans}" == 'n' ]; then
  echo "Exiting as requested."
  exit 0
fi

echo ""
echo "Committing changes for insight-ui..."
sleep 2
git commit -S

echo ""
echo "Pushing changes to Github..."
git push origin master && git push upstream master

echo ""
echo "Signing a tag"
git tag -s "${tag}" -m"${tag}"


echo ""
echo "Pushing the tag to upstream..."
git push upstream "${tag}"

echo ""
echo "Publishing to npm..."
npm publish --tag beta

popd

#############################################
# bitcore
#############################################

echo ""
echo "Releasing bitcore..."
sleep 2
pushd "${bitcoreDir}"

bump_version
set_deps

npm install

git add .
git diff --staged
echo ""
echo -n 'Resume?: (Y/n): '

read ans

if [ "${ans}" == 'n' ]; then
  echo "Exiting as requested."
  exit 0
fi

echo ""
echo "Committing changes for bitcore..."
sleep 2
git commit -S

echo ""
echo "Pushing changes to Github..."
git push origin master && git push upstream master

echo ""
echo "Signing a tag"
git tag -s "${tag}" -m"${tag}"


echo ""
echo "Pushing the tag to upstream..."
git push upstream "${tag}"

echo ""
echo "Publishing to npm..."
npm publish --tag beta

popd

echo "Completed releasing tag: ${tag}"
