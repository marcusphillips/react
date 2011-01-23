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

test('containing strings', function(){
  var node = $('<div mv="contain \'example\'"></div>')[0];
  mv.update(node, {});
  equal(node.innerHTML, 'example', 'contain directive inserted a string');
});

test('containing variables', function(){
  var node = $('<div mv="contain \key\"></div>')[0];
  mv.update(node, {key:'value'});
  equal(node.innerHTML, 'value', 'contain directive inserted a variable');
});

