#! /usr/bin/env sh
#
# Helper script run from travis to deploy the app
#
# deploy to davonez in addition to ionic view for debug
# Ionic upload failing see https://github.com/ionic-team/ionic/issues/11872
ionic upload --email $IONIC_EMAIL --password $IONIC_PASSWORD
# ssh-keyscan 176.58.107.25  >> ~/.ssh/known_hosts
# scp -i .travis/travis_rsa.pem platforms/android/build/outputs/apk/android-debug.apk shazleto@176.58.107.25:~/clicker