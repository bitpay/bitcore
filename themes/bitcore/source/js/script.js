(function($){
  // Create menu for mobile devices
  var menuHtml = [],
    lastTag = '';

  menuHtml.push('<select id="page-mobile-menu">');
  menuHtml.push('<option value="">Navigate...</option>');

  $('#sidebar').children().each(function(){
    var tag = this.tagName.toLowerCase(),
      $this = $(this);

    switch (tag){
      case 'strong':
        if (lastTag === 'a') menuHtml.push('</optgroup>');

        menuHtml.push('<optgroup label="' + $this.html() + '">');
        break;

      case 'a':
        menuHtml.push('<option value="' + $this.attr('href') + '">' + $this.html() + '</option>');
        break;
    }

    lastTag = tag;
  });

  menuHtml.push('</optgroup>');
  menuHtml.push('</select>');

  $('#mobile-menu-wrap').html(menuHtml.join(''));

  $('#page-mobile-menu').on('change', function(){
    var val = $(this).find(':selected').val();

    if (val) location.href = val;
  });

  // Select text in getting started input in home page
  $('#banner-getting-started-input').on('click', function(){
    $(this).select();
  });

  // Main navigation menu for mobile devices
  $('#main-nav-toggle').on('click', function(){
    $('#main-nav').toggleClass('on');
  });
/*
  $('.api-options input').on('change', function(){
    var value = $(this).val(),
      checked = $(this).prop('checked');

    $('.api-item.' + value).css({
      display: checked ? 'block' : 'none'
    });
  });*/
})(jQuery);