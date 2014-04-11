exports.patch = function(Buffers) {
  Buffers.prototype.skip = function (i) {
    if (i == 0) {
      return;
    } else if (i == this.length) {
      this.buffers = [];
      this.length = 0;
      return;
    }
    var pos = this.pos(i);
    this.buffers = this.buffers.slice(pos.buf);
    this.buffers[0] = new Buffer(this.buffers[0].slice(pos.offset));
    this.length -= i;
  };
};
