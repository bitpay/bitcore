hexo.extend.tag.register('note', function(args, content){
  var className = args.shift(),
    header = '';

  if (args.length){
    header += '<strong class="note-title">' + args.join(' ') + '</strong>';
  }

  return [
    '<escape><blockquote class="note ' + className + '">' + header + '</escape>',
    content,
    '<escape></blockquote></escape>'
  ].join('\n\n') + '\n';
}, {ends: true, escape: false});