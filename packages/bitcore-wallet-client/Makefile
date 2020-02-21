.PHONY: cover

BIN_PATH:=node_modules/.bin/

all:	bitcore-wallet-client.js

clean:
	rm bitcore-wallet-client.js

bitcore-wallet-client.js: index.js lib/*.js
	${BIN_PATH}browserify $< > $@

cover:
	./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- --reporter spec test
