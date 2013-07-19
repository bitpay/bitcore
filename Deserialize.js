
exports.intFromCompact = function(c)
{
	var bytes = (c >> 24) & 0xff;
	var v = (c & 0xffffff) << (8 * (bytes - 3));
	return v;
}

