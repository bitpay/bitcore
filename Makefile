.PHONY: test cover
test:
	./node_modules/.bin/mocha 
cover:
	./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- --reporter spec test
