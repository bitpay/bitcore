module.exports = function(app) {
  app.get('/messages/verify', (req, res) => {
    res.send('messages verify');
  });

  app.post('/messages/verify', (req, res) => {
    res.send('post messages verify');
  });

  app.get('/utils/estimatefee', (req, res) => {
    res.send('estimate fees');
  });
};
