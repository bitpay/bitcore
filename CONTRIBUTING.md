Contributing to Bitcore
=======

We're working hard to make *bitcore* the easier and most powerful javascript
library for working with bitcoin. Our goal is to have *bitcore* be a library
that can be used by anyone interested on bitcoin, and level the expertise
differences with a great design and documentation.

We have a pretty strict set of guidelines for contributing.

## Quick checklist

Make sure:

* `gulp lint` doesn't complain about your changes
* `gulp test` passes all the tests
* `gulp coverage` covers 100% of the branches of your code

## Design Guidelines

These are some global design goals in bitcore that any change must adhere to.

### D1 - Naming Matters

We take our time with picking names. Code is going to be written once, and read
hundreds of times.

We were inspired to name this rule first due to Uncle Bob's great work *Clean
Code*, which has a whole chapter on this subject.

In particular, you may notice that some names in this library are quite long
for the average javascript user. That's because we better have a long but
comprehensible name rather than an abbreviation that might confuse new users.

### D2 - Tests

Write a test for all your code. We encourage Test Driven Development so we know
when our code is right. We migrated from our original code base with a 80% test
coverage and are targeting 100% as we move towards our 1.0 release.

### D3 - Robustness Principle

*Be conservative in what you send, be liberal in what you accept.*

Interfaces accept as much types of arguments as possible, so there's no mental
tax on using them: we want to avoid questions such as "should I use a string
here or a buffer?", "what happens if I'm not sure if the type of this variable
is an Address instance or a string with it encoded in base-58?" or "what kind
of object will I receive after calling this function?".

Accept a wide variety of usages and arguments, always return an internal kind
of object. For example, the class `PublicKey` can accept strings or buffers
with a DER encoded public key (either compressed or uncompressed), another
PublicKey, a PrivateKey, or a Point, an instance of the `elliptic.js` library
with the point in bitcoin's elliptic curve that represents the public key.

### D4 - Consistency Everywhere

Consistency on the way classes are used is paramount to allow an easier
understanding of the library.

## Style Guidelines

The design guidelines have quite a high abstraction level. These style
guidelines are easier to detect and apply, and also more opinionated (the
design guidelines mentioned above are the way we think about general software
development and we believe they should be present on any software project).

### G1 - General: No Magic Numbers

Avoid constants in the code as much as possible. Magic strings are also magic
numbers.

### G2 - General: Internal Objects should be Instances

If a class has a `publicKey` member, for instance, that should be a `PublicKey`
instance.

### G3 - General: Internal amounts must be integers representing Satoshis

Avoid representation errors by always dealing with satoshis. For conversion for
frontends, use the `Unit` class.

### G4 - General: Internal network references must be Network instances

A special case for [G2](#g2---general-internal-objects-should-be-instances) all
network references must be `Network` instances (see `lib/network.js`), but when
returned to the user, its `.name` property should be used.

### G5 - General: Objects should display nicely in the console

Write a `.inspect()` method so an instance can be easily debugged in the
console.

### G6 - General: Naming Utility Namespaces

Name them in CamelCase, as they are namespaces.

DO:
```javascript
var BufferUtil = require('./util/buffer');
```
DON'T:
```javascript
var bufferUtil = require('./util/buffer');
```

### G7 - General: Standard Methods

When possible, bitcore objects should have standard methods on an instance prototype:
* `toObject` - A plain JavaScript object that can be JSON stringified
* `toJSON` - A JSON stringified object of the instance
* `toString` - A string representation of the instance
* `toBuffer` - A hex Buffer

These should have a matching static method that can be used for instantiation:
* `fromJSON` - Should handle both JSON from `toJSON` and plain JavaScript object from `toObject`
* `fromString` - Should be able to instantiate with output from `toString`
* `fromBuffer` - Should likewise be able to instantiate from output from `toBuffer`

### E1 - Errors: Use bitcore.Errors

We've designed a structure for Errors to follow and are slowly migrating to it.

Usage:
* Errors are generated in the file `lib/errors/index.js` by invoking `gulp
  errors`.
* The specification for errors is written in the `lib/errors/spec.js` file.
* Whenever a new class is created, add a generic error for that class in
  `lib/errors/spec.js`.
* Specific errors for that class should subclass that error. Take a look at the
  structure in `lib/errors/spec.js`, it should be clear how subclasses are
  generated from that file.

### E2 - Errors: Provide a getValidationError static method for classes


### I1 - Interface: Make Code that Fails Early

In order to deal with javascript's weak typing and confusing errors, we ask our
code to fail as soon as possible when an unexpected input was provided.

There's a module called `util/preconditions`, loosely based on
`preconditions.js`, based on `guava`, that we use for state and argument
checking. It should be trivial to use. We recommend using it on all methods, in
order to improve robustness and consistency.

```javascript
$.checkState(something === anotherthing, 'Expected something to be anotherthing');
$.checkArgument(something < 100, 'something', 'must be less than 100');
$.checkArgumentType(something, PrivateKey, 'something'); // The third argument is a helper to mention the name of the argument
$.checkArgumentType(something, PrivateKey); // but it's optional (will show up as "(unknown argument)")
```

### I2 - Interface: Permissive Constructors

Most classes have static methods named `fromBuffer`, `fromString`, `fromJSON`.
Whenever one of those methods is provided, the constructor for that class
should also be able to detect the type of the arguments and call the
appropriate method.

### I3 - Interface: Method Chaining

For classes that have a mutable state, most of the methods that can be chained
*SHOULD* be chained, allowing for interfaces that read well, like:

```javascript
var transaction = new Transaction()
    .from(utxo)
    .to(address, amount)
    .change(address)
    .sign(privkey);
```

### I4 - Interface: Copy Constructors

Constructors, when provided an instance of the same class, should:
* Return the same object, if the instances of this class are immutable
* Return a deep copy of the object, if the instances are mutable

Examples:
```javascript
function MyMutableClass(arg) {
  if (arg instanceof MyMutableClass) {
    return MyMutableClass._deepCopy(arg);
  }
  // ...
}
function ImmutableClass(arg) {
  if (arg instanceof ImmutableClass) {
    return arg;
  }
  // ...
}
```

### I5 - Interface: No new keyword for Constructors

Constructors should not require to be called with `new`. This rule is not
heavily enforced, but is a "nice to have".

```javascript
function NoNewRequired(args) {
  if (!(this instanceof NoNewRequired)) {
    return new NoNewRequired(args);
  }
  // ...
}
```

### T1 - Testing: Tests Must be Written Elegantly

Style guidelines are not relaxed for tests. Tests are a good way to show how to
use the library, and maintaining them is extremely necessary.

Don't write long tests, write helper functions to make them be as short and
concise as possible (they should take just a few lines each), and use good
variable names.

### T2 - Testing: Tests Must not be Random

Inputs for tests should not be generated randomly. Also, the type and structure
of outputs should be checked.

### T3 - Testing: Require 'bitcore' and look up classes from there

This helps to make tests more useful as examples, and more independent of where
they are placed. This also helps prevent forgetting to include all submodules
in the bitcore object.

DO:
```javascript
var bitcore = require('../');
var PublicKey = bitcore.PublicKey;
```
DON'T:
```javascript
var PublicKey = require('../lib/publickey');
```

## Pull Request Workflow

Our workflow is based on GitHub's pull requests. We use feature branches,
prepended with: `test`, `feature`, `fix`, `refactor`, or `remove` according to
the change the branch introduces. Some examples for such branches are:
```sh
git checkout -b test/some-module
git checkout -b feature/some-new-stuff
git checkout -b fix/some-bug
git checkout -b remove/some-file
```

We expect pull requests to be rebased to the master branch before merging:
```sh
git remote add bitpay git@github.com:bitpay/bitcore.git
git pull --rebase bitpay master
```

Note that we require rebasing your branch instead of mergeing it, for commit
readability reasons.

After that, you can push the changes to your fork, by doing:
```sh
git push origin your_branch_name
git push origin feature/some-new-stuff
git push origin fix/some-bug
```
Finally go to [github.com/bitpay/bitcore](https://github.com/bitpay/bitcore) in
your web browser and issue a new pull request.

Main contributors will review your code and possibly ask for changes before
your code is pulled in to the main repository.  We'll check that all tests
pass, review the coding style, and check for general code correctness. If
everything is OK, we'll merge your pull request and your code will be part of
bitcore.

If you have any questions feel free to post them to
[github.com/bitpay/bitcore/issues](https://github.com/bitpay/bitcore/issues).

Thanks for your time and code!
