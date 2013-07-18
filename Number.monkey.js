exports.patch = function(Number) {
  //round to specified number of places
  Number.prototype.round = function(places) {
    if(!places) return Math.round(this);
    var tmp = Math.pow(10,places);
    return Math.round(this * tmp) / tmp;
  };
};
