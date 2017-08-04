module.exports = function(app) {
  app.get('/currency', (req, res) => {
    res.send('currency');
  });
};
