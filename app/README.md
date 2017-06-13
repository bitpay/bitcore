## Ionic 2 Demo / Seed Project : Karma + Protractor + Travis
[![Build Status](https://travis-ci.org/lathonez/clicker.svg?branch=master)](https://travis-ci.org/lathonez/clicker) [![Build status](https://ci.appveyor.com/api/projects/status/github/lathonez/clicker?svg=true)](https://ci.appveyor.com/project/lathonez/clicker) [![codecov.io](https://codecov.io/github/lathonez/clicker/coverage.svg?branch=master)](https://codecov.io/github/lathonez/clicker?branch=master) [![Code Climate](https://codeclimate.com/github/lathonez/clicker/badges/gpa.svg)](https://codeclimate.com/github/lathonez/clicker) [![MIT license](http://img.shields.io/badge/license-MIT-brightgreen.svg)](http://opensource.org/licenses/MIT) [![Dependency Status](https://david-dm.org/lathonez/clicker/status.svg)](https://david-dm.org/lathonez/clicker) [![devDependency Status](https://david-dm.org/lathonez/clicker/dev-status.svg)](https://david-dm.org/lathonez/clicker#info=devDependencies)
<p align="center">
  <img src="http://lathonez.github.io/images/ionic2_unit_testing/clicker.gif" alt=""/>
</p>

## Ionic's official repo

Ionic have created an official unit testing example over at [driftyco/ionic-unit-testing-example](https://github.com/driftyco/ionic-unit-testing-example). To understand why this repo still exists, see [#239](https://github.com/lathonez/clicker/issues/239), where we looked at deprecating `clicker` in favour of `ionic-unit-testing-example`.

Broadly, the official example repo:

* Is not mature or production ready
* Is intended as a simple example only / will not be supported by Ionic
* Does not support e2e
* Does not use `@angular/cli` and thus lacks testing support from the wider ng2 community

For ~large or production projects, I suggest using clicker. For small apps / side projects the official example should suffice.

## Install & Start

You need to be running [the latest node LTS](https://nodejs.org/en/download/) or newer

```bash
git clone https://github.com/lathonez/clicker.git
cd clicker
npm install
npm start         # start the application (ionic serve)
```

Running as root? You probably shouldn't be. If you need to: `npm run postinstall` before `npm start`. [#111](https://github.com/lathonez/clicker/issues/111) for more info.

## Run Unit Tests
```bash
npm test          # run unit tests
```

## Run E2E
```
npm run e2e
```

## Blog Topics

* [Unit testing walkthrough](http://lathonez.com/2017/ionic-2-unit-testing/)
* [E2E testing walkthrough](http://lathonez.com/2017/ionic-2-e2e-testing/)
* [Removing assets from the APK](http://lathonez.com/2016/cordova-remove-assets/)

## Contribute
PRs are welcome, see the [roadmap sticky](https://github.com/lathonez/clicker/issues/38)

## Help

* If you can't get the testing working, raise an issue
* If you have a general question about unit testing (e.g. how can I write a unit test for `some-module`), see [#191](https://github.com/lathonez/clicker/issues/191)

## Acks

* This started out as a fork of [Angular 2 Seed](https://github.com/mgechev/angular2-seed) and would not be possible without it
* @bengro for the lightweightify inspiration (#68)
* @ric9176 and @DanielaGSB for E2E tests (#50)
* @tja4472 for the ngrx implementation (#133)
* [Everyone else](https://github.com/lathonez/clicker/graphs/contributors) for the advice, help, PRs etc

## Changelog

See the changelog [here](https://github.com/lathonez/clicker/blob/master/CHANGELOG.md)

## Updated for:

* **@angular/*:** 4.1.2
* **@angular/cli:**: 1.0.6
* **@ionic-angular:** 3.3.0
