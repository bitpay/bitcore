
all:	bitcore-wallet-client.min.js

clean:
	rm bitcore-wallet-client.js
	rm bitcore-wallet-client.min.js

bitcore-wallet-client.js: index.js lib/*.js
	browserify $< > $@


bitcore-wallet-client.min.js: bitcore-wallet-client.js
	node_modules/.bin/uglify  -s $<  -o $@



