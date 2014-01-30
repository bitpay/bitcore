config = {
    network: 'livenet',
    logger: 'normal' // none, normal, debug
}
if(!(typeof module === 'undefined')) {
  module.exports = config;
} else if(!(typeof define === 'undefined')) {
  define(config);
}
