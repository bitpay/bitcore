Full Node
=========

Full Node is a javascript implementation of bitcoin, forked from bitcore2,
intended to satisfy certain goals:

1) Support ease-of-use by being internally consistent. It should not be
necessary to read the source code of a class or function to know how to use it.

2) Have 100% test coverage so that the library is known to be reliable.

3) Library objects have an interface suitable for use with a command-line
interface and API, in particular having toString, fromString, toJSON, fromJSON,
methods. Other common methods are toBuffer, fromBuffer relevant for binary
formats such as transactions and blocks.

4) All standard features of the bitcoin protocol are implemented and saved in
lib/. All BIPs are correctly implemented and saved as BIPxx.js in lib/ (since
that is their standard name). Any non-standard features (such as SINs and
stealth addresses) are placed in the lib/expmt/ folder and are accessible at
fullnode.expmt. Once they are standardized and given a BIP, they are renamed and
placed in lib/.

5) It is always possible to create a new object without using "new".

6) Compatible with browserify (i.e., using require('fullnode/lib/message')
should work both in node, and be automatically work in the browser with used in
conjunction with browserify).

7) Minimize the use of dependencies so that all code can be easily audited.

8) All instance methods modify the state of the object and return the object.
To access the result of an instance method, you must access the object
property(s) that it modifies.

-------------------------
Key features:
* Stealth keys, addresses, message
* Proper handling of reading and writing big varInts
* Browserifiable
* A proper point class
* Better test coverage
* Proper message signing and verification
* npm-shrinkwrap.json ensures npm install works as intended
* byte-for-byte reading/writing scripts
