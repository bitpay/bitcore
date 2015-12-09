var Model = {};

Model.Wallet = require('./wallet');
Model.Copayer = require('./copayer');
Model.TxProposalLegacy = require('./txproposal_legacy');
Model.TxProposal = require('./txproposal');
Model.Address = require('./address');
Model.Notification = require('./notification');
Model.Preferences = require('./preferences');
Model.Email = require('./email');

module.exports = Model;
