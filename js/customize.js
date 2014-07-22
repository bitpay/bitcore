'use strict';

$(document).ready(function() {
  var form = $('#customize');
  $.ajaxSetup({
    beforeSend: function() {
      $("#loading").show();
    },
    complete: function() {
      $("#loading").hide();
    }
  });

  var cols = [$('#col1'), $('#col2'), $('#col3')];

  var cbs = [];
  var createCheckbox = function(m, nocheck) {
    var option = $('<input />');
    option.attr('value', m);
    option.attr('type', 'checkbox');
    option.attr('name', m);
    option.attr('id', 'cb' + m);
    if (!nocheck) {
      option.prop('checked', true);
    }
    var container = $('<p />');
    cbs.push(option);
    container.append(option);
    container.append($(' <label for="cb' + m + '"> ' + m + '</label>'));
    return container;
  };

  var data = "lib/Address,lib/Armory,lib/Base58,lib/HierarchicalKey,lib/BIP39,lib/BIP39WordlistEn,lib/Block,lib/Bloom,lib/Connection,lib/Deserialize,lib/ECIES,lib/Electrum,lib/Message,lib/Opcode,lib/PayPro,lib/Peer,lib/PeerManager,lib/PrivateKey,lib/RpcClient,lib/Key,lib/Point,lib/SIN,lib/SINKey,lib/Script,lib/ScriptInterpreter,lib/SecureRandom,lib/Sign,lib/sjcl,lib/Transaction,lib/TransactionBuilder,lib/Wallet,lib/WalletKey,patches/Buffers.monkey,patches/Number.monkey,config,const,networks,util/log,util/util,util/EncodedData,util/VersionedData,util/BinaryParser";
  var modules = data.split(',');
  for (var i = 0; i < modules.length; i++) {
    var m = modules[i];
    var cb = createCheckbox(m);
    var col = cols[i % 3];
    col.append(cb);
  }

  var checkall = $('#checkall');
  var none = $('#none');
  checkall.click(function() {
    for (var i = 0; i < cbs.length; i++) {
      cbs[i].prop('checked', true);
    }
  });
  none.click(function() {
    for (var i = 0; i < cbs.length; i++) {
      cbs[i].prop('checked', false);
    }
  });

  $('#download').click(function() {
    var s = '';
    var allf = true;
    var nonef = true;
    $(':checkbox').each(function() {
      if ($(this).prop('checked')) {
        nonef = false;
        if (s !== '') {
          s += ","
        }
        s += this.name;
      } else {
        allf = false;
      }
    });
    if (nonef) {
      alert('You must select at least one submodule');
      return;
    }

    var s = allf ? 'all' : s;
    var download = function(filename, text) {
      var a = window.document.createElement('a');
      a.href = window.URL.createObjectURL(new Blob([text], {
        type: 'text/plain'
      }));
      a.download = filename;
      document.body.appendChild(a)
      a.click();
      document.body.removeChild(a)
    }
    $.get('http://live.bitcore.io:3010/download/' + s,
      function(data) {
        download('bitcore.js', data);
      }
    );
  });
});
