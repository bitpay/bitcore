# *insight*

*insight* is an open-source bitcoin blockchain explorer with complete REST
and websocket APIs. Insight runs in NodeJS, uses AngularJS for the
front-end and LevelDB for storage.

Check some screenshots and more details at [insight's project homepage](http://insight.is/).

*Insight* project is now splitted in two repositories. One for the [API](https://github.com/bitpay/insight-api) and for the front-end. This repository is for the front-end, which will install the API as a NPM dependency.

## Prerequisites

* **Node.js v0.10.x** - Download and Install [Node.js](http://www.nodejs.org/download/).

* **NPM** - Node.js package manager, should be automatically installed when you get node.js.

## Quick Install
  Check the Prerequisites section above before installing.

  To install Insight, clone the main repository:

    $ git clone https://github.com/bitpay/insight.git && cd insight

  Install dependencies:

    $ npm install
    
  Run the main application:

    $ npm start
    
  Then open a browser and go to:

    http://localhost:3001

  If *insight* reports problems connecting to **bitcoind** please check the CONFIGURATION section of 
  [insight-api README](https://github.com/bitpay/insight-api/blob/master/README.md). To set the 
  environment variables run something like:
  
     $ INSIGHT_NETWORK=livenet BITCOIND_USER=user BITCOIND_PASS=pass INSIGHT_PUBLIC_PATH=public  npm start


  Please note that the app will need to sync its internal database
  with the blockchain state, which may take some time. You can check
  sync progress from within the web interface. More details about that process
  on [insight-api README](https://github.com/bitpay/insight-api/blob/master/README.md). 
  
  
## Nginx Setup

To use Nginx as a reverse proxy for Insight, use the following base [configuration](https://gist.github.com/matiu/bdd5e55ff0ad90b54261)


## Development

To run insight locally for development mode:

Install bower dependencies:

```$ bower install```

To compile and minify the web application's assets:

```$ grunt compile```

There is a convinent Gruntfile.js for automation during editing the code

```$ grunt```



In case you are developing *insight* and *insight-api* toghether, you can do the following:

* Install insight and insight-api on the same path ($IROOT)
```
  $ cd $IROOT/insight
  $ grunt
```
in other terminal:
```
  $ cd $IROOT/insight-api 
  $ ln -s ../insight/public
  $ INSIGHT_PUBLIC_PATH=public node insight.js 
```


```INSIGHT_PUBLIC_PATH=insight/public  grunt```
at insight-api's home path (edit the path according your setup).

**also** in the insight-api path. (So you will have to grunt process running, one for insight and one for insight-api).


## Note

For more details about the *insight API* configs and end-point, just go to [insight API github repository](https://github.com/bitpay/insight-api) or read the [documentation](https://github.com/bitpay/insight-api/blob/master/README.md)

## Contribute

Contributions and suggestions are welcomed at [insight github repository](https://github.com/bitpay/insight).


## License
(The MIT License)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
