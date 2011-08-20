test('after a lookup failure on leaf object that falls through to parent level in scope chain, an update to the key on the leaf scope removes listener on parent scope', function(){
  var node = $('\
    <div react="within child">\
      <div id="child" react="contain prop"></div>\
    <span></span></div>\
  ')[0];
  var object = {
    prop: 'parent prop',
    child: {
    }
  };

  react.anchor(node, object);
  react.update(node);
  equal($('#child', node).html(), 'parent prop', 'containment falls through to parent prop');
  react.set(object.child, 'prop', 'child prop');
  equal($('#child', node).html(), 'child prop', 'containment is replaced with child prop');
  object.child.prop = 'changed child prop';
  react.set(object, 'prop', 'changed parent prop');
  equal($('#child', node).html(), 'child prop', 'child prop is not updated since it is not listening to parent prop');
  react.changed(object.child, 'prop');
  equal($('#child', node).html(), 'changed child prop', 'child prop gets updated on change');
});
