$('.ribbon a').click(function () {
  analytics.track('Clicked top github ribbon, desktop');
});

$('.ribbon-phone a').click(function () {
  analytics.track('Clicked top github link, mobile');
});

$('#logo').click(function () {
  analytics.track('Clicked logo');
});

$('#logo').click(function () {
  analytics.track('Clicked cta');
});

$('#mc-embedded-subscribe-form').submit(function( e ) {
  analytics.identify('019mr8mf4r', {
    email: $('#mce-EMAIL').value()
  });
  analytics.track('Submitted email subscription');
});