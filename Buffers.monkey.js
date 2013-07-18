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
    this.buffers[0].length -= pos.offset;
    this.buffers[0].offset += pos.offset;
    this.length -= i;
  };
};
