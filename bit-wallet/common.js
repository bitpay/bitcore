var common = function() {};


var die = common.die = function(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
};

common.parseMN = function(MN) {
  if (!MN) 
    die('No m-n parameter');
  var mn = MN.split('-');

  var m = parseInt(mn[0]); 
  var n = parseInt(mn[1]);

  if (!m || ! n) {
    die('Bad m-n parameter');
  }

  return [m, n];
};


module.exports = common;
