module("contain");

test('containing strings', function(){
  var node = $('<div mv="contain \'example\'"></div>')[0];
  mv.update(node, {});
  equal(node.innerHTML, 'example', 'contain directive inserted a string');
});

test('containing variables', function(){
  var node = $('<div mv="contain key"></div>')[0];
  mv.update(node, {key:'value'});
  equal(node.innerHTML, 'value', 'contain directive inserted a string variable');
});

test('containing node variables', function(){
  var node = $('<div mv="contain child"></div>')[0];
  var child = $('<div/>')[0];
  mv.update(node, {child:child});
  equal($(node).children()[0], child, 'contain directive inserted a node variable');
});
