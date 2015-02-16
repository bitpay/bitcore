function ServerCompromissedError(message) {
  this.code = 'SERVERCOMPROMISSED';
  this.message = message;
};

module.exports = ServerCompromissedError;
