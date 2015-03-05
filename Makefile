
BIN_PATH:=node_modules/.bin/

all:	bitcore-wallet-client.min.js

clean:
	rm bitcore-wallet-client.js
	rm bitcore-wallet-client.min.js

bitcore-wallet-client.js: index.js lib/*.js
	${BIN_PATH}browserify $< > $@


bitcore-wallet-client.min.js: bitcore-wallet-client.js
	${BIN_PATH}uglify  -s $<  -o $@



