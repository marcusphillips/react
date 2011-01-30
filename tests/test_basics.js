module("basics");

test('select', function(){
  var grandchild = $('<span mv=""/>')[0];
  var child = $('<p/>').html(grandchild)[0];
  var node = $('<div/>').html(child)[0];
  var results = mv._select(node);
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

test('keys can use dot operator', function(){
  var node = $('<div mv="contain key.subkey"/>')[0];
  mv.update(node, {key:{subkey:'content'}});
  equal($(node).html(), 'content', 'key resolved while using a dot operator');
});
