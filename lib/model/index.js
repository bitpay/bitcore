var Model = {};

Model.Wallet = require('./wallet');
Model.Copayer = require('./copayer');
Model.TxProposal = require('./txproposal');
Model.Address = require('./address');
Model.Notification = require('./notification');
Model.Preferences = require('./preferences');
Model.Email = require('./email');
Model.TxNote = require('./txnote');
Model.Session = require('./session');
Model.PushNotificationSub = require('./pushnotificationsub');
Model.TxConfirmationSub = require('./txconfirmationsub');

module.exports = Model;
