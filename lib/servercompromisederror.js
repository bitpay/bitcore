function ServerCompromisedError(message) {
  this.code = '';
  this.message = message;
};

module.exports = ServerCompromisedError;
