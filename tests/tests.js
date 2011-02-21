/*
 * helpers
 */

var throws = function(block, description){
  var didThrow = false;
  try{
    block();
  } catch (x) {
    didThrow = true;
  }
  ok(didThrow, description);
};


/*
 * basics
 */

module("basics");

test('errors on unknown commands', function(){
  var node = $('<div react="nonexistentcommand arg1"></div>')[0];
  throws(function(){
    react.update(node, {});
  }, 'throws at nonexistantcommand');
});

test('keys can use dot operator', function(){
  var node = $('<div react="contain key.subkey"/>')[0];
  react.update(node, {key:{subkey:'content'}});
  equal($(node).html(), 'content', 'key resolved while using a dot operator');
});

test('calling update returns the root', function(){
  var node = $('<div id="foo"></div>')[0];
  equal(react.update(node, {}), node, 'same node was returned');
});

test('rendering to nodes that are nested in others still works', function(){
  var $parent = $('<div></div>');
  var $child = $('<div react="contain foo"></div>');
  $parent.html($child);
  react.update($child[0], {foo:'bar'});
  equal($child.html(), 'bar', 'the child node got the appropriate content');
});

test('rendering to nodes that are nested in others still works, an additional layer deep', function(){
  var $parent = $('<div></div>');
  var $child = $('<div><div react="contain foo"></div></div>');
  $parent.html($child);
  react.update($child[0], {foo:'bar'});
  equal($child.children().first().html(), 'bar', 'the child node got the appropriate content');
});

/*
 *  containing
 */

module("contain");

test('containing strings', function(){
  var node = $('<div react="contain \'example\'"></div>')[0];
  react.update(node, {});
  equal(node.innerHTML, 'example', 'contain directive inserted a string');
});

test('containing variables', function(){
  var node = $('<div react="contain key"></div>')[0];
  react.update(node, {key:'value'});
  equal(node.innerHTML, 'value', 'contain directive inserted a string variable');
});

test('containing node variables', function(){
  var node = $('<div react="contain child"></div>')[0];
  var child = $('<div/>')[0];
  react.update(node, {child:child});
  equal($(node).children()[0], child, 'contain directive inserted a node variable');
});


/*
 * attributes
 */

module("attributes");

test('setting string attributes', function(){
  var node = $('<div react="attr \'foo\' \'bar\'"/>')[0];
  react.update(node, {});
  equal($(node).attr('foo'), 'bar', 'attribute was written correctly');
});

test('substituting variables in attribute names', function(){
  var node = $('<div react="attr attrName \'bar\'"/>')[0];
  react.update(node, {attrName:'foo'});
  equal($(node).attr('foo'), 'bar', 'attribute was written correctly');
});

test('substituting variables in attribute values', function(){
  var node = $('<div react="attr \'foo\' value"/>')[0];
  react.update(node, {value:'bar'});
  equal($(node).attr('foo'), 'bar', 'attribute was written correctly');
});

test('conditionally adding attributes', function(){
  var node = $('<div react="attrIf condition \'foo\' \'bar\'"/>')[0];

  react.update(node, {condition:true});
  equal($(node).attr('foo'), 'bar', 'attribute was added when condition is true');

  react.update(node, {condition:false});
  equal($(node).attr('foo'), undefined, 'attribute was not added when condition is false');

  react.update(node, {condition:undefined});
  equal($(node).attr('foo'), undefined, 'attribute was not added when condition is undefined');

  react.update(node, {condition:true});
  equal($(node).attr('foo'), 'bar', 'attribute was re-added when condition is true');
});


/*
 *  conditionals
 */

module("conditionals");

test('conditional display', function(){
  var node = $('<div react="showIf key"></div>')[0];
  react.update(node, {key:false});
  equal($(node).css('display'), 'none', 'node is hidden when key is false');
  react.update(node, {key:true});
  equal($(node).css('display') || 'block' /*chrome returns an empty string for default display value*/, 'block', 'node is shown again when key is changed to true');
});

test('conditional visibility', function(){
  var node = $('<div react="visIf key"></div>')[0];
  react.update(node, {key:false});
  equal($(node).css('visibility'), 'hidden', 'node is invisible when key is false');
  react.update(node, {key:true});
  equal($(node).css('visibility'), 'visible', 'node is visible again when key is changed to true');
});

test('conditional classes', function(){
  var node = $('<div class="bar" react="classIf condition \'foo\'"/>')[0];
  ok($(node).hasClass('bar'), 'node starts out with a bar class');
  react.update(node, {condition:false});
  ok(!$(node).hasClass('foo'), 'class was not added when condition is false');
  ok($(node).hasClass('bar'), 'bar class was not removed');
  react.update(node, {condition:true});
  ok($(node).hasClass('foo'), 'class was added when condition is false');
  ok($(node).hasClass('bar'), 'bar class was not removed');
  react.update(node, {});
  ok(!$(node).hasClass('foo'), 'class was removed when condition is undefined');
  ok($(node).hasClass('bar'), 'bar class was not removed');
});

test('conditional attributes', function(){
  var node = $('<div react="attrIf condition \'foo\' \'bar\'"/>')[0];
  react.update(node, {condition:false});
  equal($(node).attr('foo'), undefined, 'attribute was not added when condition is false');
  react.update(node, {condition:true});
  equal($(node).attr('foo'), 'bar', 'attribute was added when condition is true');
});

test('conditions can be negated', function(){
  var node = $('<div react="attrIf !condition \'foo\' \'bar\'"/>')[0];
  react.update(node, {condition:false});
  equal($(node).attr('foo'), 'bar', 'attribute was added when negated condition is false');

  node = $('<div react="attrIf ! condition \'foo\' \'bar\'"/>')[0];
  react.update(node, {condition:false});
  equal($(node).attr('foo'), 'bar', 'with a space, attribute was added when negated condition is false');
});


/*
 * loops
 */

module("loop");

test('works with a missing key alias', function(){/*...*/});

test('requires at least an item template node and a contents node inside the loop node', function(){
  throws(function(){
    react.update($('<div react="loop as item">'
                + '<span class="exampleTemplate"></span>'
                + '<!-- to prevent debeloper surprise, the missing container tag here is required -->'
              + '</div>')[0], []);
  }, 'omitting second loop child is not allowed');
});

test('can loop across values in an array', function(){
  var node = $('<div id="outter" react="loop as which item"><div id="item" react="contain item"></div><div id="container"></div></div>')[0];
  var itemTemplate = $(node).children()[0];
  var resultsHolder = $(node).children()[1];
  react.update(node, ['a','b','c']);
  equal($(node).children().last().children().length, 3, 'results container node contains three child elements');
  same([
    $($(resultsHolder).children()[0]).html(),
    $($(resultsHolder).children()[1]).html(),
    $($(resultsHolder).children()[2]).html()
  ], ['a','b','c'], 'children\'s innerHTML is set to array items\' contents');
  equal($(itemTemplate).html(), '', 'item template was unchanged');
});

test('can loop across keys in an array', function(){
  var node = $('\
    <div react="loop as which item">\
      <div react="contain which"></div>\
    <div></div></div>\
  ')[0];
  var resultsHolder = $(node).children()[1];
  react.update(node, ['a','b','c']);
  same([
    $($(resultsHolder).children()[0]).html(),
    $($(resultsHolder).children()[1]).html(),
    $($(resultsHolder).children()[2]).html()
  ], ['0','1','2'], 'children\'s innerHTML is set to array key\'s contents');
});

test('functions bound at loop time evaluate in correct context', function(){
  var node = $('\
    <div react="loop as which item">\
      <div react="contain item"></div>\
    <div></div></div>\
  ')[0];
  var resultsHolder = $(node).children()[1];
  react.update(node, ['a', function(){return this[2];}, 'b']);
  same([
    $($(resultsHolder).children()[0]).html(),
    $($(resultsHolder).children()[1]).html(),
    $($(resultsHolder).children()[2]).html()
  ], ['a','b','b'], 'children\'s innerHTML is set to array key\'s contents');
});

test('looping several times on different sized arrays results in different amounts of result contents nodes', function(){
  var node = $('\
    <div react="loop">\
      <div react="contain foo"></div>\
    <span></span></div>\
  ')[0];
  var resultsHolder = $(node).children()[1];
  react.update(node, [{foo:'a'}, {foo:'b'}, {foo:'c'}]);
  same($(resultsHolder).children().length, 3, '3 children for inital render');
  react.update(node, [{foo:'a'}, {foo:'b'}]);
  same($(resultsHolder).children().length, 2, '2 children for inital render');
  react.update(node, [{foo:'a'}, {foo:'b'}, {foo:'c'}, {foo:'d'}]);
  same($(resultsHolder).children().length, 4, '4 children for inital render');
});

test('looping without an as clause implies a within statement', function(){
  var node = $('\
    <div react="loop">\
      <div react="contain foo"></div>\
    <span></span></div>\
  ')[0];
  var resultsHolder = $(node).children()[1];
  react.update(node, [{foo:'a'}, {foo:'b'}, {foo:'c'}]);
  same([
    $($(resultsHolder).children()[0]).html(),
    $($(resultsHolder).children()[1]).html(),
    $($(resultsHolder).children()[2]).html()
  ], ['a','b','c'], 'children took their values from item objects\' foo properties');
});

test('nested loops', function(){
  var $node = $('\
    <div react="loop">\
      <div react="loop">\
        <div react="contain foo"></div>\
      <span></span></div>\
    <span></span></div>\
  ');
  react.update($node[0], [[{foo:'a'}]]);
  var $outterResultsHolder = $node.children().last();
  var $innerLoop = $outterResultsHolder.children().first();
  var $innerResultsHolder = $innerLoop.children().last();
  same($innerResultsHolder.children().first().html(), 'a', 'doubly nested children took their values from item objects\' foo properties');
});

test('results are put in second dom node', function(){
  var node = $('<div react="loop as which item">'
               + '<div react="contain item">'
               + '</div>'
               + '<div id="intended_destination"></div>'
               + '<div></div>'
             + '</div>')[0];
  var resultsHolder = $(node).find('#intended_destination');
  react.update(node, ['a']);
  same($($(resultsHolder).children()[0]).html(), 'a', 'child\'s innerHTML is set to array elemnt\'s value');
});

test('originally rendered nodes are preserved on rerender', function(){
  var node = $('\
    <div react="loop as which item">\
      <div react="contain item"></div>\
    <span></span></div>\
  ')[0];
  var resultsHolder = $(node).children()[1];
  react.update(node, ['a', 'b', 'c']);
  var originalChildren = $(resultsHolder).children();
  react.update(node, ['d', 'e', 'f']);
  var updatedChildren = $(resultsHolder).children();
  for(var i = 0; i < 3; i++){
    equal(originalChildren[i], updatedChildren[i], 'dom node '+i+' was reused');
  }
});


/*
 * within
 */

module("within");

test('scope can be shifted within a property', function(){
  var node = $('<div react="within subobject, contain key"/>')[0];
  react.update(node, {subobject: {key: 'content'}, key:'wrongContent'});
  equal($(node).html(), 'content', 'content was correct from within a subobject');

  var node = $('<div react="within subobject, contain key"/>')[0];
  react.update(node, {subobject: {}, key:'content'});
  equal($(node).html(), 'content', 'key fell through fell through to next higher scope when local key is missing');

  var node = $('<div react="within subobject, contain key"/>')[0];
  react.update(node, {subobject: {key: undefined}, key:'content'});
  equal($(node).html(), 'content', 'key fell through fell through to next higher scope when local key is undefined');
});


/*
 * function properties
 */

test('functions get evaluated', function(){
  var node = $('<div react="contain foo"></div>')[0];
  react.update(node, {
    foo:function(){
      return 'bar';
    }
  });
  same(node.innerHTML, 'bar', 'function result was inserted');
});

test('functions evaluate in correct context', function(){
  var node = $('<div react="contain foo"></div>')[0];
  react.update(node, {
    bar: 'right',
    foo:function(){
      return this.bar;
    }
  });
  same(node.innerHTML, 'right', 'function evaluated with the correct this object');
});

test('functions can be dot accessed', function(){
  var node = $('<div react="contain foo.bar"></div>')[0];
  var didRun = false;
  var object = {
    foo: function(){
      didRun = true;
      return 'wrong';
    }
  };
  object.foo.bar = function(){
    return 'right';
  };
  react.update(node, object);
  ok(!didRun, 'namespacing functions are not run');
  same(node.innerHTML, 'right', 'function result was inserted');
});


/*
 * anchor
 */

module('anchor');

test('can name objects', function(){
  var obj = {};
  react.name('foo', obj);
  equal(react.scopes.foo, obj, 'react.scopes held the specified object at the specified name');
});

test('anchored nodes are prepended to scope chains on render', function(){
  var outter = $('<div react="anchored obj"></div>')[0];
  var inner = $('<div react="contain foo"></div>')[0];
  $(outter).html(inner);
  react.name('obj', {foo:'bar'});
  react.update(outter, {});
  equal($(inner).html(), 'bar', 'inner node had access to outter node\'s anchor object');
});

// todo: test support for anchoring to whole scope chains

test('anchored nodes re-render on object change', function(){
  var object = {foo:1, bar:1};
  var node1 = $('<div react="contain foo"></div>')[0];
  var node2 = $('<div react="contain bar"></div>')[0];
  react.anchor(node1, object);
  react.update(node1);
  react.anchor(node2, object);
  react.update(node2);
  object.foo = object.bar = 2;
  react.changed(object);
  same([node1.innerHTML, node2.innerHTML], ['2','2'], 'anchored nodes were updated when relevant object was changed');
});

test('changing values on an anchored object results in automatic change to the view', function(){
  var object = {foo:'bar'};
  var node = $('<div react="classIf foo foo"></div>')[0];
  react.update({node: node, scope: object, anchor: true});
  ok($(node).hasClass('bar'), 'node got correct first class');
  react.set(object, 'foo', 'baz');
  ok(!$(node).hasClass('foo'), 'node does not have first class anymore');
  ok($(node).hasClass('baz'), 'node got correct second class');
});

test('calling changed on anchored objects doesn\'t re-render properties on anchored nodes that are listening to other scopes', function(){
  var o1 = {foo:true}, o2 = {bar:true};
  var node = $('<div react="classIf foo \'foo\', classIf bar \'bar\'"></div>')[0];
  react.update({node: node, scopes: [o1,o2], anchor: true});
  same([$(node).hasClass('foo'), $(node).hasClass('bar')], [true, true], 'anchored nodes were initialized correctly');
  o1.foo = o2.bar = false;
  react.changed(o1);
  same([$(node).hasClass('foo'), $(node).hasClass('bar')], [false, true], 'anchored nodes were updated when relevant object was changed, but not for properties on objects not notified of change');
});

test('updating anchored nodes does not revisit all nodes', function(){
  var object = {foo:1, bar:1};
  var node = $('<div>\
    <div react="contain foo"></div>\
    <div react="contain bar"></div>\
  </div>')[0];
  react.update({node: node, scope: object, anchor: true});
  object.bar = 2;
  react.set(object, 'foo', 2);
  same($(node).children()[0].innerHTML, '2', 'for anchored nodes, properties that are set using react.set() get autmatically updated');
  same($(node).children()[1].innerHTML, '1', 'properties changed manually are not rerendered');
});

test('unanchored nodes can have properties set with no side effects', function(){
  var object = {foo:1, bar:1};
  var node = $('<div>\
    <div react="contain foo"></div>\
    <div react="contain bar"></div>\
  </div>')[0];
  react.update(node, object);
  object.bar = 2;
  react.set(object, 'foo', 2);
  same($(node).children()[0].innerHTML, '1', 'for unanchored nodes, properties that are set using react.set() are not updated');
  same($(node).children()[1].innerHTML, '1', 'properties changed manually are alos not rerendered');
});

test('updating anchored nodes does not revisit all nodes', function(){
  var object = {foo:1, bar:{
    baz: 1
  }};
  var node = $('<div>\
    <div react="contain foo"></div>\
    <div react="within bar">\
      <div react="contain baz"></div>\
    </div>\
  </div>')[0];
  react.update({node: node, scope: object, anchor: true});
  react.set(object.bar, 'baz', 2);
  same($(node).children().last().children().first().html(), '2', 'when properties within properties get changed, their corresponding nodes are changed as well');
});

test('changing object strucutre invalidates change propogation to the view', function(){
  var object = {
    foo: {
      bar: 1
    }
  };
  var node = $('<div react="within foo">\
    <div react="contain bar"></div>\
  </div>')[0];
  react.update({node: node, scope: object, anchor: true});
  var foo = object.foo;
  object.foo = { bar: 'wrong' };
  react.set(foo, 'bar', 'alsowrong');
  same($(node).children().first().html(), '1', 'the property linked to the replaced object was not re-rendered');
  object.foo = foo;
  react.set(foo, 'bar', 'right');
  same($(node).children().first().html(), 'right', 'the property linked to the replaced object was re-rendered after the object was put back');
});

test('changing dom strucutre invalidates change propogation to the view', function(){
  var object = {
    foo: {
      bar: 1
    }
  };
  var node = $('<div react="within foo">\
    <div react="contain bar"></div>\
  </div>')[0];
  var $child = $(node).children();
  react.update({node: node, scope: object, anchor: true});
  $(node).html('');
  react.set(object.foo, 'bar', 2);
  same($child.html(), '1', 'the property linked to the replaced object was not re-rendered');
  $(node).html($child);
  react.set(object.foo, 'bar', 3);
  same($child.html(), '3', 'the property linked to the replaced object was re-rendered after the object was put back');
});

