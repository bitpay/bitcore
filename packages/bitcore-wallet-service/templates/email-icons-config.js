const iconMap = {
  new_copayer: 'person-plus.png',
  new_incoming_tx: 'down-arrow-green.png',
  new_incoming_tx_testnet: 'down-arrow-green.png',
  new_outgoing_tx: 'up-arrow-gray.png',
  new_tx_proposal: 'writing-gray.png',
  new_zero_outgoing_tx: 'up-arrow-gray.png',
  tx_confirmation: 'green-check.png',
  tx_confirmation_receiver: 'green-check.png',
  tx_confirmation_sender: 'green-check.png',
  txp_finally_rejected: 'failed-icon.png',
  wallet_complete: 'green-check.png'
};

const getIconHtml = (templateName) => {
  const iconFile = iconMap[templateName];
  if (!iconFile) {
    return null;
  }

  const staticUrl = 'https://bws.bitpay.com';
  const iconUrl = `${staticUrl}/bws/static/images/${iconFile}`;
  
  return {
    imgHtml: `<img src="${iconUrl}" alt="${templateName} icon" style="width: 70px; height: 70px;" />`
  };
};

module.exports = {
  getIconHtml
}; 