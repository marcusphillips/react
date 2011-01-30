module("within");

test('scope can be shifted within a property', function(){
  var node = $('<div mv="within subobject, contain key"/>')[0];
  mv.update(node, {subobject: {key: 'content'}, key:'wrongContent'});
  equal($(node).html(), 'content', 'content was correct from within a subobject');

  var node = $('<div mv="within subobject, contain key"/>')[0];
  mv.update(node, {subobject: {}, key:'content'});
  equal($(node).html(), 'content', 'key fell through fell through to next higher scope when local key is missing');

  var node = $('<div mv="within subobject, contain key"/>')[0];
  mv.update(node, {subobject: {key: undefined}, key:'content'});
  equal($(node).html(), 'content', 'key fell through fell through to next higher scope when local key is undefined');
});

