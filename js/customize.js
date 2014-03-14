'use strict';

$(document).ready(function(){
  var form = $('#customize');
  var modules = [
    'Address',
    'Block',
    'Bloom',
    'Buffers.monkey',
    'Connection',
    'Deserialize',
    'Number.monkey',
    'Opcode',
    'Peer',
    'PeerManager',
    'PrivateKey',
    'RpcClient',
    'Key',
    'SIN',
    'SINKey',
    'Script',
    'ScriptInterpreter',
    'Sign',
    'Transaction',
    'Wallet',
    'WalletKey',
    'config',
    'const',
    'networks',
    'util/log',
    'util/util',
    'util/EncodedData',
    'util/VersionedData',
  ];

  var cols = [$('#col1'), $('#col2'), $('#col3')];

  var cbs = [];
  var createCheckbox = function(m, nocheck) {
    var option = $('<input />');
    option.attr('value', m);
    option.attr('type', 'checkbox');
    option.attr('name', m);
    option.attr('id', 'cb'+m);
    if (!nocheck) {
      option.attr('checked', 'checked');
    }
    var container = $('<p />');
    cbs.push(option);
    container.append(option);
    container.append($('<label for="cb'+m+'"> '+m+'</label>'));
    return container;
  };
  
  for (var i=0; i<modules.length; i++) {
    var m = modules[i];
    var cb = createCheckbox(m);
    var col = cols[i % 3];
    col.append(cb);
  }

  var checkall = $('#checkall');
  var none = $('#none');
  checkall.click(function() {
    for (var i=0; i<cbs.length; i++) {
      cbs[i].prop('checked', true);
    }
  });
  none.click(function() {
    for (var i=0; i<cbs.length; i++) {
      cbs[i].prop('checked', false);
    }
  });


});
