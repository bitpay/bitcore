const Input = require('./input');

function TaprootInput() {
  Input.apply(this, arguments);
}
inherits(TaprootInput, Input);

/**
 * Query whether the input is signed
 * @return {boolean}
 */
TaprootInput.prototype.isFullySigned = function() {
  return this.script.isPublicKeyHashIn() || this.hasWitnesses();
};


module.exports = TaprootInput;
