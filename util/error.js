/**
 * Used during transcation verification when a source txout is missing.
 *
 * When a transaction is being verified by the memory pool this error causes
 * it to be added to the orphan pool instead of being discarded.
 */
function MissingSourceError(msg, missingTxHash) {
  // TODO: Since this happens in normal operation, perhaps we should
  //       avoid generating a whole stack trace.
  Error.call(this);
  // This is not compatible with firefox.
  //  Error.captureStackTrace(this, arguments.callee);
  this.message = msg;
  this.missingTxHash = missingTxHash;
  this.name = 'MissingSourceError';
};

MissingSourceError.prototype = Object.create(Error.prototype);

exports.MissingSourceError = MissingSourceError;


/**
 * Used in several places to indicate invalid data.
 *
 * We want to distinguish invalid data errors from program errors, so we use
 * this exception to indicate the former.
 */
function VerificationError(msg, missingTxHash) {
  // TODO: Since this happens in normal operation, perhaps we should
  //       avoid generating a whole stack trace.
  Error.call(this);

  // This is not compatible with firefox.
  //  Error.captureStackTrace(this, arguments.callee);
  this.message = msg;
  this.missingTxHash = missingTxHash;
  this.name = 'VerificationError';
};

VerificationError.prototype = Object.create(Error.prototype);

exports.VerificationError = VerificationError;
