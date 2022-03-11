function TaprootBuilder() {
  if (!(this instanceof TaprootBuilder)) {
    return new TaprootBuilder();
  }

  this.branch = [];

  // TODO: do we need this class?

  throw new Error('TaprootBuilder was called. This is a marker for suspended work.');
};

/** Add a new script at a certain depth in the tree. Add() operations must be called
 *  in depth-first traversal order of binary tree. If track is true, it will be included in
 *  the GetSpendData() output. */
TaprootBuilder.prototype.add = function(depth, script, leafVersion, track = true) {

};