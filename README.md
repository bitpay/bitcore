bitcore2
========

Bitcore 2 is a rewrite of bitcore to satisfy several goals:

1) Support ease-of-use by being internally consistent. It should not be
necessary to read the source code of a class or function to know how to use it.
I.e., where in old bitcore a "privkey" might be anything from a buffer to a hex
string to a key to a private key object, in bitcore 2 "privkey" is the same
type of object always and everywhere.

2) Have 100% test coverage so that the library is known to be reliable.

3) Library objects have an interface suitable for use with a command-line
interface and API, in particular having toString, fromString, toObject,
fromObject methods.

4) All standard features of the bitcoin protocol are implemented and saved in
lib/. All BIPs are correctly implemented and saved as BIPxx.js in lib/ (since
that is their standard name). Any non-standard features (such as SINs and
stealtha addresses) are placed in the lib/expmt/ folder and are accessible at
bitcore.expmt. Once they are standardized and given a BIP, they are renamed and
placed in lib/.

5) It is always possible to create a new object without using "new".

6) Compatible with browserify (i.e., using require('bitcore/lib/message')
should work both in node, and be automatically work in the browser with used in
conjunction with browserify).

7) Minimize the use of dependencies so that all code can be easily audited.
