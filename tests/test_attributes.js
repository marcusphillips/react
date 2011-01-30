module("attributes");

test('setting string attributes', function(){
  var node = $('<div mv="attr \'foo\' \'bar\'"/>')[0];
  mv.update(node, {});
  equal($(node).attr('foo'), 'bar', 'attribute was written correctly');
});

test('substituting variables in attribute names', function(){
  var node = $('<div mv="attr attrName \'bar\'"/>')[0];
  mv.update(node, {attrName:'foo'});
  equal($(node).attr('foo'), 'bar', 'attribute was written correctly');
});

test('substituting variables in attribute values', function(){
  var node = $('<div mv="attr \'foo\' value"/>')[0];
  mv.update(node, {value:'bar'});
  equal($(node).attr('foo'), 'bar', 'attribute was written correctly');
});

test('conditionally adding attributes', function(){
  var node = $('<div mv="attrIf condition \'foo\' \'bar\'"/>')[0];

  mv.update(node, {condition:true});
  equal($(node).attr('foo'), 'bar', 'attribute was added when condition is true');

  mv.update(node, {condition:false});
  equal($(node).attr('foo'), undefined, 'attribute was not added when condition is false');

  mv.update(node, {condition:undefined});
  equal($(node).attr('foo'), undefined, 'attribute was not added when condition is undefined');

  mv.update(node, {condition:true});
  equal($(node).attr('foo'), 'bar', 'attribute was re-added when condition is true');
});
