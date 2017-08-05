module.exports = function messageAPI(router) {
  router.get('/messages/verify', (req, res) => {
    res.send('messages verify');
  });

  router.post('/messages/verify', (req, res) => {
    res.send('post messages verify');
  });

  router.get('/utils/estimatefee', (req, res) => {
    res.send('estimate fees');
  });
};
