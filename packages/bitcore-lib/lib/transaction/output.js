'use strict';

var _ = require('lodash');
var BN = require('../crypto/bn');
var bufferUtil = require('../util/buffer');
var JSUtil = require('../util/js');
var BufferWriter = require('../encoding/bufferwriter');
var Script = require('../script');
var $ = require('../util/preconditions');
var errors = require('../errors');
const Interpreter = require('../script/interpreter');
const TaggedHash = require('../crypto/taggedhash');

var MAX_SAFE_INTEGER = 0x1fffffffffffff;

function Output(args) {
  if (!(this instanceof Output)) {
    return new Output(args);
  }
  if (_.isObject(args)) {
    this.satoshis = args.satoshis;
    if (bufferUtil.isBuffer(args.script)) {
      this.setScriptFromBuffer(args.script);
    } else {
      var script;
      if (_.isString(args.script) && JSUtil.isHexa(args.script)) {
        script = Buffer.from(args.script, 'hex');
      } else {
        script = args.script;
      }
      this.setScript(script);
    }

    if (args.type === 'taproot') {
      this.branch = [];
      Object.defineProperty(this, 'isValid', {
        configurable: false,
        enumerable: false,
        get: function() {
          this._isValid || this._branch.length === 0;
        },
        set: function(isValid) {
          this._isValid = isValid;
        }
      });
      Object.defineProperty(this, 'isComplete', {
        configurable: false,
        enumerable: false,
        get: function() {
          return this.isValid && (this._branch.length === 0 || (this._branch.length === 1 && !!this._branch[0]));
        }
      });
    }
  } else {
    throw new TypeError('Unrecognized argument for Output');
  }
}

Object.defineProperty(Output.prototype, 'script', {
  configurable: false,
  enumerable: true,
  get: function() {
    if (this._script) {
      return this._script;
    } else {
      this.setScriptFromBuffer(this._scriptBuffer);
      return this._script;
    }

  }
});

Object.defineProperty(Output.prototype, 'satoshis', {
  configurable: false,
  enumerable: true,
  get: function() {
    return this._satoshis;
  },
  set: function(num) {
    if (num instanceof BN) {
      this._satoshisBN = num;
      this._satoshis = num.toNumber();
    } else if (_.isString(num)) {
      this._satoshis = parseInt(num);
      this._satoshisBN = BN.fromNumber(this._satoshis);
    } else {
      $.checkArgument(
        JSUtil.isNaturalNumber(num),
        'Output satoshis is not a natural number'
      );
      this._satoshisBN = BN.fromNumber(num);
      this._satoshis = num;
    }
    $.checkState(
      JSUtil.isNaturalNumber(this._satoshis),
      'Output satoshis is not a natural number'
    );
  }
});

Output.prototype.invalidSatoshis = function() {
  if (this._satoshis > MAX_SAFE_INTEGER) {
    return 'transaction txout satoshis greater than max safe integer';
  }
  if (this._satoshis !== this._satoshisBN.toNumber()) {
    return 'transaction txout satoshis has corrupted value';
  }
  if (this._satoshis < 0) {
    return 'transaction txout negative';
  }
  return false;
};

Output.prototype.toObject = Output.prototype.toJSON = function toObject() {
  var obj = {
    satoshis: this.satoshis
  };
  obj.script = this._scriptBuffer.toString('hex');
  return obj;
};

Output.fromObject = function(data) {
  return new Output(data);
};

Output.prototype.setScriptFromBuffer = function(buffer) {
  this._scriptBuffer = buffer;
  try {
    this._script = Script.fromBuffer(this._scriptBuffer);
    this._script._isOutput = true;
  } catch(e) {
    if (e instanceof errors.Script.InvalidBuffer) {
      this._script = null;
    } else {
      throw e;
    }
  }
};

Output.prototype.setScript = function(script) {
  if (script instanceof Script) {
    this._scriptBuffer = script.toBuffer();
    this._script = script;
    this._script._isOutput = true;
  } else if (_.isString(script)) {
    this._script = Script.fromString(script);
    this._scriptBuffer = this._script.toBuffer();
    this._script._isOutput = true;
  } else if (bufferUtil.isBuffer(script)) {
    this.setScriptFromBuffer(script);
  } else {
    throw new TypeError('Invalid argument type: script');
  }
  return this;
};

Output.prototype.inspect = function() {
  var scriptStr;
  if (this.script) {
    scriptStr = this.script.inspect();
  } else {
    scriptStr = this._scriptBuffer.toString('hex');
  }
  return '<Output (' + this.satoshis + ' sats) ' + scriptStr + '>';
};

Output.fromBufferReader = function(br) {
  var obj = {};
  obj.satoshis = br.readUInt64LEBN();
  var size = br.readVarintNum();
  if (size !== 0) {
    obj.script = br.read(size);
  } else {
    obj.script = Buffer.from([]);
  }
  return new Output(obj);
};

Output.prototype.toBufferWriter = function(writer) {
  if (!writer) {
    writer = new BufferWriter();
  }
  writer.writeUInt64LEBN(this._satoshisBN);
  var script = this._scriptBuffer;
  writer.writeVarintNum(script.length);
  writer.write(script);
  return writer;
};

Output.prototype.calculateSize = function() {
  let result = 8; // satoshis
  result += BufferWriter.varintBufNum(this._scriptBuffer.length).length;
  result += this._scriptBuffer.length;
  return result;
};

/**
 * Taproot only
 * Add a new script at a certain depth in the tree. Add() operations must be called
 *  in depth-first traversal order of binary tree. If track is true, it will be included in
 *  the GetSpendData() output.
 * @param {Number} depth Tree depth at which to insert the node (depth is 0-based)
 * @param {Script} script 
 * @param {Number} leafVersion 
 * @param {Boolean} track If true, the leaf will be included in GetSpendData() output
 */
Output.prototype.add = function(depth, script, leafVersion, track = true) {
  $.checkArgument((leafVersion & ~Interpreter.TAPROOT_LEAF_MASK) === 0, 'invalid leafVersion');
  if (!this.isValid) {
    return;
  }

  const node = {
    hash: TaggedHash.TAPLEAF.writeUInt8(leafVersion).write(script.toBuffer()).finalize(),
    leaves: []
  };
  if (track) {
    const leafInfo = {
      script,
      leafVersion,
      merkleBranch: []
    };
    node.leaves.push(leafInfo);
  }
  this._insertNode(node, depth);
  return this;
};


Output.prototype._insertNode = function(node, depth) {
  $.checkArgument(depth >= 0 && depth <= Interpreter.TAPROOT_CONTROL_MAX_NODE_COUNT, 'invalid depth');
  /* We cannot insert a leaf at a lower depth while a deeper branch is unfinished. Doing
   * so would mean the Add() invocations do not correspond to a DFS traversal of a
   * binary tree. */
  if (depth + 1 < this._branch.length) {
    this.isValid = false;
    return;
  }
  /* As long as an entry in the branch exists at the specified depth, combine it and propagate up.
   * The 'node' variable is overwritten here with the newly combined node. */
  while (this.isValid && this._branch.length > depth && this._branch[depth]) {
    node = this._combineNodes(node, this._branch[depth]);
    this._branch = this._branch.slice(0, this._branch.length - 2);
    if (depth == 0) {
      this.isValid = false; /* Can't propagate further up than the root */
    }
    depth--;
  }
  if (this.isValid) {
    /* Make sure the branch is big enough to place the new node. */
    if (this._branch.length <= depth) {
      this._branch = this._branch.slice(0, depth + 1);
    }
    $.checkState(!this._nodes[depth]);
    m_branch[depth] = node;
  }
};

Output.prototype._combineNodes = function(a, b) {
  const ret = {
    hash: null,
    leaves: []
  };
  /* Iterate over all tracked leaves in a, add b's hash to their Merkle branch, and move them to ret. */
  for (let leaf of a.leaves) {
    leaf.merkleBranch.push(b.hash);
    ret.leaves.push(leaf);
  }
  /* Iterate over all tracked leaves in b, add a's hash to their Merkle branch, and move them to ret. */
  for (let leaf of b.leaves) {
    leaf.merkleBranch.push(a.hash);
    ret.leaves.push(leaf);
  }
  /* Lexicographically sort a and b's hash, and compute parent hash. */
  if (a.hash.compare(b.hash) === -1) {
    ret.hash = TaggedHash.TAPBRANCH.write(a.hash).write(b.hash).finalize();
  } else {
    ret.hash = TaggedHash.TAPBRANCH.write(b.hash).write(a.hash).finalize();
  }
  return ret;
};


/**
 * Finalize the construction. Can only be called when IsComplete() is true.
 *  internal_key.IsFullyValid() must be true.
 * @param {PublicKey} pubKey 
 */
Output.prototype.finalize = function(pubKey) {
  $.checkState(this.isComplete === true, 'finalize can only be called when isComplete is true');
  const ret = pubKey.createTapTweak(this._branch.length === 0 ? null : this._branch[0].hash);

};

module.exports = Output;
