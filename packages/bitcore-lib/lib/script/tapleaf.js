var TapLeaf = function TapLeaf({ id, script, leafVersion }) {
  if (!(this instanceof TapLeaf)) {
    return new TapLeaf();
  }
  
  Object.defineProperty(this, 'id', {
    value: id,
    enumerable: false,
    configurable: false,
    writable: false
  });

  Object.defineProperty(this, 'leafVersion', {
    value: leafVersion,
    enumerable: false,
    configurable: false,
    writable: false
  });

  Object.defineProperties(this, 'script', {
    value: this._parseScript(script),
    enumerable: false,
    configurable: false,
    writable: false
  });
};

TapLeaf.prototype._parseScript = function(script) {
  const Script = require('./script');
  if (script instanceof Script) {
    return script;
  }
  if (typeof script === 'string') {
    return Script.fromString(script);
  }
};

module.exports = TapLeaf;