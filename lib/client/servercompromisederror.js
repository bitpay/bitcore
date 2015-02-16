function ServerCompromisedError(message) {
  this.code = 'SERVERCOMPROMISED';
  this.message = message;
};

module.exports = ServerCompromisedError;
