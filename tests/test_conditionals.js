module("conditionals");

test('conditional display', function(){
  var node = $('<div mv="showIf key"></div>')[0];
  mv.update(node, {key:false});
  equal($(node).css('display'), 'none', 'node is hidden when key is false');
  mv.update(node, {key:true});
  equal($(node).css('display'), 'block', 'node is shown again when key is changed to true');
});

test('conditional visibility', function(){
  var node = $('<div mv="visIf key"></div>')[0];
  mv.update(node, {key:false});
  equal($(node).css('visibility'), 'hidden', 'node is invisible when key is false');
  mv.update(node, {key:true});
  equal($(node).css('visibility'), 'visible', 'node is visible again when key is changed to true');
});

test('conditions can be negated', function(){
  var node = $('<div mv="attrIf !condition \'foo\' \'bar\'"/>')[0];

  mv.update(node, {condition:false});
  equal($(node).attr('foo'), 'bar', 'attribute was added when negated condition is false');

  var node = $('<div mv="attrIf ! condition \'foo\' \'bar\'"/>')[0];

  mv.update(node, {condition:false});
  equal($(node).attr('foo'), 'bar', 'with a space, attribute was added when negated condition is false');
});

