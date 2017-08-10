
var draw_qrcode = function(text, typeNumber, errorCorrectLevel) {
	document.write(create_qrcode(text, typeNumber, errorCorrectLevel) );
};

var create_qrcode = function(text, typeNumber, errorCorrectLevel, table) {

	var qr = qrcode(typeNumber || 4, errorCorrectLevel || 'M');
	qr.addData(text);
	qr.make();

//	return qr.createTableTag();
	return qr.createImgTag();
};

var update_qrcode = function() {
	var text = document.forms[0].elements['msg'].value.
		replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
	document.getElementById('qr').innerHTML = create_qrcode(text);
};
