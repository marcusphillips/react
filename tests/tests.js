module("update function");

test('select', function(){
  var grandchild = $('<span mv=""/>')[0];
  var child = $('<p/>').html(grandchild)[0];
  var node = $('<div/>').html(child)[0];
  var results = mv.select(node);
  equal(results.length, 2, 'results included 2 nodes');
  ok(js.among(results, node), 'node itself was selected');
  ok(!js.among(results, child), 'non-mv child was not selected');
  ok(js.among(results, grandchild), 'mv grandchild was selected');
});

test('errors on unknown commands', function(){
  var node = $('<div mv="nonexistentcommand arg1"></div>')[0];
  raises(function(){
    mv.update(node, {});
  }, 'throws at nonexistantcommand');
});

test('containing strings', function(){
  var node = $('<div mv="contain \'example\'"></div>')[0];
  mv.update(node, {});
  equal(node.innerHTML, 'example', 'contain directive inserted a string');
});

test('containing variables', function(){
  var node = $('<div mv="contain key"></div>')[0];
debugger;
  mv.update(node, {key:'value'});
  equal(node.innerHTML, 'value', 'contain directive inserted a string variable');
});

test('containing node variables', function(){
  var node = $('<div mv="contain child"></div>')[0];
  var child = $('<div/>')[0];
  mv.update(node, {child:child});
  equal($(node).children()[0], child, 'contain directive inserted a node variable');
});

test('keys can use dot operator', function(){
  var node = $('<div mv="contain key.subkey"/>')[0];
  mv.update(node, {key:{subkey:'content'}});
  equal($(node).html(), 'content', 'key resolved while using a dot operator');
});

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

test('conditions can be negated', function(){
  var node = $('<div mv="attrIf !condition \'foo\' \'bar\'"/>')[0];

  mv.update(node, {condition:false});
  equal($(node).attr('foo'), 'bar', 'attribute was added when negated condition is false');

  var node = $('<div mv="attrIf ! condition \'foo\' \'bar\'"/>')[0];

  mv.update(node, {condition:false});
  equal($(node).attr('foo'), 'bar', 'with a space, attribute was added when negated condition is false');
});

test('scope can be shifted within a property', function(){
  var node = $('<div mv="within subobject, contain key"/>')[0];
  mv.update(node, {subobject: {key: 'content'}, key:'wrongContent'});
  equal($(node).html(), 'content', 'content was correct from within a subobject');

  var node = $('<div mv="within subobject, without, contain key"/>')[0];
  mv.update(node, {subobject: {key: 'wrongcontent'}, key:'content'});
  equal($(node).html(), 'content', 'content was correct after shifting within and without a subobject');

  var node = $('<div mv="within subobject, without, contain key"/>')[0];
  mv.update(node, {subobject: {otherkey: 'wrongcontent'}, key:'content'});
  equal($(node).html(), 'content', 'key fell through fell through to next higher scope when local key is missing');

  var node = $('<div mv="within subobject, without, contain key"/>')[0];
  mv.update(node, {subobject: {key: undefined}, key:'content'});
  equal($(node).html(), 'content', 'key fell through fell through to next higher scope when local key is undefined');
});

