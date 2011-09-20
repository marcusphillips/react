(function(){

var $originalFixtureNodes, nodes, scopes;

react.integrate.jQuery();

$(function(){
  $originalFixtureNodes = $('#fixture-nodes').remove();
});

for(var key in {'join':1}){
  jQuery.fn[key] = jQuery.fn[key] || Array.prototype[key];
}

/*
 * clone new fixture nodes from those found in tests/index.html
 */
var refreshNodes = function(){
  js.errorIf(!$originalFixtureNodes, 'fixture nodes not defined before attempted node refresh!');
  nodes = {};
  for(var i = 0; i < 5; i++){
    $originalFixtureNodes.clone().find('[data-fixture]').each(function(which, node){
      var key = $(node).attr('data-fixture') + (i ? (i+1).toString() : '');
      $(node).attr('data-fixture', key);
      nodes['$'+key] = $(node);
      nodes[key] = node;
    });
  }
};

/*
 * For each test
 */
QUnit.testStart = function(){
  refreshNodes();
  scopes = makeFixtureScopes();
};

QUnit.testDone = function(){
  $('#qunit-fixture')[0].innerHTML = '';
};

/*
 * helpers
 */

var throws = function(block, description){
  var didThrow = false;
  try{
    block();
  } catch (error) {
    didThrow = true;
  }
  ok(didThrow, description);
};


/*
 * basics
 */

module("basics");

test('errors on unknown commands', function(){
  throws(function(){ nodes.$broken.anchor({}); }, 'throws at nonexistent command');
});

test('calling update returns the root', function(){
  equal(react.update(nodes.inert, {}), nodes.inert, 'same node was returned');
});

test('calling update with a jQuery object returns the same object', function(){
  equal(nodes.$inert.anchor({}), nodes.$inert, 'same jQuery object was returned');
});

test('keys can use dot operator', function(){
  equal(nodes.$addressDotStreet.anchor(scopes.alice).html(), 'cornell', 'key resolved while using a dot operator');
});

test('reactive nodes need not be at the top level', function(){
  nodes.$inert.html(nodes.name).anchor(scopes.alice);
  equal(nodes.$name.html(), 'alice', 'the child node got the appropriate content');
});

test('rendering to nodes that are nested in others still works, an additional layer deep', function(){
  nodes.$inert.html(nodes.inert2);
  nodes.$inert2.html(nodes.name).anchor(scopes.alice);
  equal(nodes.name.innerHTML, 'alice', 'the child node got the appropriate content');
});

/*
 *  containing
 */

module("contain");

test('containing strings', function(){
  equal(nodes.$containingStringLiteral.anchor(scopes.inert).html(), 'example', 'contain directive inserted a string');
});

test('containing variables', function(){
  equal(nodes.$name.anchor(scopes.alice).html(), 'alice', 'contain directive inserted a string variable');
  scopes.alice.set('name', 'alison');
  same(nodes.$name.html(), 'alison', 'new name is inserted');
  scopes.alice.del('name');
  same(nodes.$name.html(), '', 'deleting a property of an anchored scope causes a rerender');
});

test('containing node variables', function(){
  react.update(nodes.containingWidget, {widget:nodes.inert});
  equal(nodes.$containingWidget.children()[0], nodes.inert, 'contain directive inserted a node variable');
});

test('containing react nodes', function(){
  nodes.$containingWidget.anchor({widget:nodes.name, name:'nobody'});
  equal(nodes.$name.html(), 'orig', 'react directive of contained node was not followed');
});


/*
 * attributes
 */

module("attributes");

test('setting string attributes', function(){
  react.update(nodes.withAttributesFromStrings, scopes.inert);
  equal(nodes.$withAttributesFromStrings.attr('name'), 'value', 'attribute was written correctly');
});

test('substituting variables in attribute names', function(){
  react.update(nodes.withDynamicAttributeName, scopes.alice.car);
  equal(nodes.$withDynamicAttributeName.attr('chitty'), 'value', 'attribute was written correctly');
});

test('substituting variables in attribute names', function(){
  react.update(nodes.withDynamicAttributeValue, scopes.alice.car);
  equal(nodes.$withDynamicAttributeValue.attr('name'), '$4000', 'attribute was written correctly');
});

test('substituting variables in attribute values', function(){
  react.update(nodes.mugshot, scopes.alice);
  equal(nodes.$mugshot.attr('src'), 'example.com', 'attribute was written correctly');
});

/*
 *  conditionals
 */

module("conditionals");

test('conditional display', function(){
  equal(nodes.$adminIcon.anchor(scopes.bob).css('display'), 'none', 'node is hidden when key is false');
  equal(nodes.$adminIcon.anchor(scopes.alice).css('display') || 'block' /*chrome returns an empty string for default display value*/, 'block', 'node is shown again when key is changed to true');
});

test('conditional visibility', function(){
  equal(nodes.$verifiedBadge.anchor(scopes.hacker).css('visibility'), 'hidden', 'node is invisible when key is false');
  equal(nodes.$verifiedBadge.anchor(scopes.bob).css('visibility'), 'visible', 'node is visible again when key is changed to true');
});

test('conditional classes', function(){
  var originalClassRemains = function(){ return nodes.$adminIcon.hasClass('icon'); };
  ok(originalClassRemains() && !nodes.$adminIcon.anchor(scopes.bob).hasClass('active'), 'class was not added when condition is false');
  ok(originalClassRemains() && nodes.$adminIcon.anchor(scopes.alice).hasClass('active'), 'class was added when condition is true');
  ok(originalClassRemains() && !nodes.$adminIcon.anchor({}).hasClass('active'), 'class was removed when condition is undefined');
  originalClassRemains();
});

test('conditionally adding attributes', function(){
  equal(nodes.$adminIcon.anchor(scopes.alice).attr('data-admin'), 'true', 'attribute was added when condition is true');
  equal(nodes.$adminIcon.anchor(scopes.hacker).attr('data-admin'), undefined, 'attribute was not added when condition is false');
  equal(nodes.$adminIcon.anchor(scopes.bob).attr('data-admin'), undefined, 'attribute was not added when condition is undefined');
  equal(nodes.$adminIcon.anchor(scopes.alice).attr('data-admin'), 'true', 'attribute was re-added when condition is true');
});


test('conditions can be negated', function(){
  equal(nodes.$adminIcon.anchor(scopes.bob).attr('data-user'), 'true', 'attribute was added when negated condition is false');
  ok($('<div react="classIf ! condition \'activated\'"/>').anchor({condition:false}).hasClass('activated'), 'with a space, attribute was added when negated condition is false');
});

test('if directives turn off recursion in subsequent directives of the same node', function(){
  equal(nodes.$adminEmail.attr('data-email'), 'orig', 'node starts out with original value');
  equal(nodes.$adminEmail.anchor(scopes.alice).attr('data-email'), 'alice@startup.com', 'contents get set when condition is true');
  equal(nodes.$adminEmail.anchor(scopes.bob).attr('data-email'), 'alice@startup.com', 'contents went unchanged when condition is false');
  scopes.bob.set('isAdmin', true);
  equal(nodes.$adminEmail.attr('data-email'), 'bob@webmail.com', 'contents changed when property was updated to true');
});

test('if directives turn off recursion in child nodes', function(){
  react.update(nodes.$adminEmail, scopes.alice);
  equal(nodes.$adminEmailLink.html(), 'alice@startup.com', 'contents get set when condition is true');
  nodes.$adminEmail.anchor(scopes.bob);
  equal(nodes.$adminEmailLink.html(), 'alice@startup.com', 'contents went unchanged when condition is false');
  scopes.bob.set('isAdmin', true);
  equal(nodes.$adminEmailLink.html(), 'bob@webmail.com', 'contents changed when property was updated to true');
});


/*
 * looping
 */

module("within");

test('works with a missing key alias', function(){/*...*/});

test('requires at least an item template node and a contents node inside the loop node', function(){
  throws(function(){ nodes.$containerlessLoop.anchor([]); }, 'omitting second loop child is not allowed');
});

test('template node is not visible after render', function(){
  $('#qunit-fixture').html(nodes.friends);
  ok(nodes.$friendTemplate.is(':visible'), 'template started out visible');
  nodes.$friends.anchor(scopes.alice.friends);
  ok(nodes.$friendTemplate.is(':not(:visible)'), 'template was no longer visible');
});

test('can loop across values in an array', function(){
  react.update(nodes.friends, scopes.alice.friends);
  equal(nodes.$friendsContainer.children().length, 4, 'results container node contains three child elements');
  same(nodes.$friendsContainer.children().map(function(){return $(this).attr('data-name');}).join(','), 'bob,charlie,david,ellen', 'children\'s innerHTML is set to array items\' contents');
});

test('does not operate on loop item template node', function(){
  nodes.$friends.anchor(scopes.alice.friends);
  equal(nodes.$friendTemplate.attr('data-name'), 'orig', 'item template was unchanged');
});

test('does not operate on descendants of loop item template node', function(){
  nodes.$friends.anchor(scopes.alice.friends);
  equal(nodes.$friendName.html(), 'orig', 'item template was unchanged');
});

test('does not operate on descendants of loop item template node, even when loop item template has no react attribute', function(){
  nodes.$navItems.anchor(scopes.navItems);
  same(nodes.$navItemText.html(), 'orig', 'the contained node\'s directives were ignored');
});

test('calling changed on a subobject that\'s associated with a within directive does not attempt to rerender all directives on the node', function(){
  nodes.$businessStreet.anchor(scopes.alice);
  same(nodes.$businessStreet.attr('name'), 'alice', 'attr came from outer prop');
  same(nodes.$businessStreet.html(), 'main', 'contents came from inner prop');
  scopes.alice.name = 'alison';
  scopes.alice.business.set('address', {street:'huffington'});
  same(nodes.$businessStreet.attr('name'), 'alice', 'attr was not changed');
  same(nodes.$businessStreet.html(), 'huffington', 'contents got updated');
});

test('can loop across keys in an array', function(){
  nodes.$indexIterator.anchor(scopes.alice.friends);
  same(nodes.$indexIteratorResults.children().map(function(){return this.innerHTML;}).join(','), '0,1,2,3', 'children\'s innerHTML is set to array key\'s contents');
});

test('functions bound at loop time evaluate in correct context', function(){
  var node = $('\
    <div react="for which item">\
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

test('results are put in second dom node', function(){
  var node = $('<div react="for which item">\
    <div react="contain item"></div>\
    <div id="intended_destination"></div>\
    <div id="decoy"></div>\
  </div>')[0];
  var resultsHolder = $(node).find('#intended_destination');
  react.update(node, ['a']);
  same($($(resultsHolder).children()[0]).html(), 'a', 'child\'s innerHTML is set to array elemnt\'s value');
});

test('originally rendered nodes are preserved on rerender', function(){
  var node = $('\
    <div react="for which item">\
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

test('loops can be changed()', function(){
  var node = $('<div react="for which item">\
    <div react="contain item"></div>\
  <span class="resultsHolder"></span></div>')[0];

  var testItems = function(node, data){
    var resultsHolder = $(node).children()[1];
    var children =  $(resultsHolder).children();
    for(var i = 0; i < data.length; i++){
      equal($(children[i]).html(), data[i], 'dom node '+i+' contains expected value');
    }
    equal(children.length, data.length, 'list item length is the same as dom node count');
  };

  var data = ['a', 'b'];
  react.anchor( node, data );
  react.update( node );
  testItems(node, data);
  data.push('c');
  react.changed(data);
  testItems(node, data);
  data.pop();
  data.pop();
  react.changed(data);
  testItems(node, data);
});


/*
 * withinEach
 */

module("withinEach");

test('looping several times on different sized arrays results in different amounts of result contents nodes', function(){
  var node = $('\
    <div react="withinEach">\
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

test('withinEach implies a within statement on item nodes', function(){
  var node = $('\
    <div react="withinEach">\
      <div react="contain foo"></div>\
    <span></span></div>\
  ')[0];
  var resultsHolder = $(node).children()[1];
  var list = [{foo:'a'}, {foo:'b'}, {foo:'c'}];
  react.update({node:node, scope:list, anchor:true});
  same([
    $($(resultsHolder).children()[0]).html(),
    $($(resultsHolder).children()[1]).html(),
    $($(resultsHolder).children()[2]).html()
  ], ['a','b','c'], 'children took their values from item objects\' foo properties');
  list[0].foo = 'new a';
  react.changed(list[0], 'foo');
  same($($(resultsHolder).children()[0]).html(), 'new a', 'regression test: withinItem directive still applies after change event');
});

test('nested withinEachs', function(){
  var $node = $('\
    <div react="withinEach">\
      <div react="withinEach">\
        <div react="contain foo"></div>\
      <span></span></div>\
    <span></span></div>\
  ');
  react.update($node[0], [[{foo:'a'}]]);
  var $outerResultsHolder = $node.children().last();
  var $innerLoop = $outerResultsHolder.children().first();
  var $innerResultsHolder = $innerLoop.children().last();
  same($innerResultsHolder.children().first().html(), 'a', 'doubly nested children took their values from item objects\' foo properties');
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
  react.update(node, {subobject: {}, key:'content'});
  equal($(node).html(), 'content', 'key fell through to next higher scope when local key is not in object undefined');

  var node = $('<div react="within subobject, contain key"/>')[0];
  react.update(node, {subobject: {key: undefined}, key:'content'});
  equal($(node).html(), '', 'key did not fall through when local key is in object, but undefined');
});

test('within directive works well with changed method', function(){
  same(nodes.$withinAddress.anchor(scopes.alice).html(), 'cornell', 'street gets set');
  scopes.alice.set('street', 'promenade');
  same(nodes.$withinAddress.html(), 'cornell', 'address stays the same because it\'s looking at .address.street, not on .street');
  scopes.alice.address.set('street', 'ashbury');
  same(nodes.$withinAddress.html(), 'ashbury', 'when address\'s street changes, the output changes');
});

test('within directive doesn\'t halt updates to the changed loop', function(){
  // regression test: https://github.com/marcusphillips/react/issues/3
  nodes.$multipleWithins.anchor(scopes.alice);
  $(scopes.alice.address.set('street', 'ashbury'));
  same(nodes.$firstDescendant.html(), 'ashbury', 'first descendant gets set');
  same(nodes.$secondDescendant.html(), 'ashbury', 'second descendant gets set');
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
  var outer = $('<div react="anchored obj"></div>')[0];
  var inner = $('<div react="contain foo"></div>')[0];
  $(outer).html(inner);
  react.name('obj', {foo:'bar'});
  react.update(outer, {});
  equal($(inner).html(), 'bar', 'inner node had access to outer node\'s anchor object');
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
  var node = $('<div react="attr \'foo\' foo, attr \'bar\' bar"></div>')[0];
  react.update({node: node, scope: object, anchor: true});
  same($(node).attr('foo'), '1', 'foo starts out at 1');
  same($(node).attr('bar'), '1', 'bar starts out at 1');
  object.bar = 2;
  react.set(object, 'foo', 2);
  same($(node).attr('foo'), '2', 'for anchored nodes, properties that are set using react.set() get autmatically updated');
  same($(node).attr('bar'), '1', 'properties changed manually are not rerendered');
});


/*
 * changed
 */

test('calling changed on an array updates associated list items', function(){
  var object = ['foo'];
  var node = $('\
    <div react="for which item">\
      <div class="item" react="contain item"></div>\
    <span id="container"></span></div>\
  ')[0];
  react.update({node: node, scope: object, anchor: true});
  same($('#container .item', node).first().html(), 'foo', 'item substitution starts out as foo');
  react.set(object, 0, 'baz');
  same($('#container .item', node).first().html(), 'baz', 'item substitution got changed');
});

test('regression test: index key binding is still available at change response time', function(){
  var object = [{}, {}];
  var node = $('<div react="for which item">\
      <div class="item" react="within item, contain which"></div>\
  <span id="container"></span></div>')[0];
  react.update({node: node, scope: object, anchor: true});
  same($($('#container .item', node)[1]).html(), '1', 'which is available after an update operation');
  react.set(object, 1, {});
  same($($('#container .item', node)[1]).html(), '1', 'which is still available after a change response');
});

test('', function(){
// todo: write a test this for inadvertent fallthrough, for the case where lookup of a withinItem key hits undefined and falls through this._lookupInScopeChain(args[0], lastLink)
});

test('regression test: a withinEach inside a for will not get duplicate bindings', function(){
  var object = [[{prop:'a'}, {prop:'b'}]];
  var node = $('\
    <div react="for which item">\
      <div class="item" react="within item, withinEach">\
        <span class="innerTemplate" react="contain which"></span>\
        <span class="innerContainer"></span>\
      </div>\
    <span id="container"></span></div>\
  ')[0];
  react.update({node: node, scope: object, anchor: true});
  same($($('#container .innerContainer .innerTemplate', node)[1]).html(), '0', 'there is only one element in the outer array, so index substitution (binding to the key "which") should always be 0');
  react.set(object, 0, [{prop:'c'}, {prop:'d'}]);
  // before the bug fix, the binding instruction from the outer 'for' directive never got blown away as the scope chain got built up
  // thus, there would have been an extra key binding scope, instead of the normal withinEach style scope change into a property
  same($($('#container .innerContainer .innerTemplate', node)[1]).html(), '0', 'index substitution is still set to 0');
  react.set(object, 0, [{which:'foo'}, {which:'bar'}]);
  same($($('#container .innerContainer .innerTemplate', node)[1]).html(), 'bar', 'index substitution changes to the masking property');
});

test('when a list item is removed, associated loop item nodes disappear', function(){
/* todo
  var object = ['a', 'b'];
  var node = $('\
    <div react="for which item">\
      <span class="item" react="contain item"></span>\
    <span id="container"></span></div>\
  ')[0];
  react.update({node: node, scope: object, anchor: true});
  same($($('#container .item', node)[1]).html(), 'b', 'second item got set');
  object.slice(0,1);
  react.changed(object, 1);
  // before the bug fix, the binding instruction from the outer 'for' directive never got blown away as the scope chain got built up
  // thus, there would have been an extra key binding scope, instead of the normal withinEach style scope change into a property
  same($('#container .item', node).length, 1, 'redundant node got deleted');
*/
});

test('increasing the length property of a list appends extra nodes', function(){
});

test('reducing the length property of a list deletes extra nodes', function(){

});

test('lookups to loop items don\'t fall through past the top scope if that item holds undefined', function(){
  // not yet tested
});

test('don\'t allow looping within non-enumerable (or non-observable) objects', function(){
//  ok(false, 'not yet written');
});

test('recomputes all subnodes when changing the value stored at some index of an observed array that was looped over', function(){
//  ok(false, 'not yet written');
});

///*
test('loop items get bound to their indices', function(){
  var object = ['a', 'b'];
  var node = $('\
    <div react="for which item">\
      <div class="item" react="contain item"></div>\
    <span id="container"></span></div>\
  ')[0];
  react.update({node: node, scope: object, anchor: true});
  same($($('#container .item', node)[1]).html(), 'b', 'substitution starts out as b');
  react.set(object, 1, 'bPrime');
  same($($('#container .item', node)[1]).html(), 'bPrime', 'substitution gets set to b prime');
});
//*/

test('event handlers don\'t dissapear on call to changed()', function(){
  var subNode = $('<div><div id="clicker">increment</div></div>')[0];
  var object  = {foo:1, 'subNode':subNode};
  jQuery( '#clicker', subNode).bind('click', function(){
    object.foo += 1;
    react.changed(object);
  });

  var node = $('<div>\
    <div id="foo" react="contain foo"></div>\
    <div react="contain subNode"></div>\
  </div>')[0];
  react.update({node: node, scope: object, anchor: true});
  same(jQuery( '#foo', node)[0].innerHTML, '1', 'foo got set');
  $('#clicker', subNode).trigger( 'click' );
  same(jQuery( '#foo', node).html(), '2', 'foo got updated');
  $('#clicker', subNode).trigger( 'click' );
  same(jQuery( '#foo', node).html(), '3', 'foo got updated after changed');
});

test('can anchor in update operation with three arguments', function(){
  var object = {foo:'bar'};
  var node = react.update($('<div react="contain foo"></div>')[0], object, {anchor: true});
  object.foo = 'baz';
  react.update(node);
  same(node.innerHTML, 'baz', 'node got the new value from the anchored object');
});

test('event handlers don\'t get lost by loop insertion', function(){
  var wasClicked;
  var insertion = $('<div></div>').click(function(){
    wasClicked = true;
  })[0];
  var node = react.update($('<div react="for item">\
    <div react="contain item"></div>\
    <div></div>\
  </div>')[0], [insertion]);

  $(insertion).click();
  ok(wasClicked, 'click was noticed, even though node was inserted by a looping construct');
});

test('event handlers don\'t get lost by loop item creation', function(){
  var wasClicked;
  var insertion = $('<div class="insertion"></div>').click(function(){
    wasClicked = true;
  })[0];
  var insertions = [insertion];
  var node = react.update($('<div react="for item">\
    <div react="contain item"></div>\
    <div></div>\
  </div>')[0], insertions, {anchor: true});

  $(node).find('.insertion').click();
  ok(wasClicked, 'click was noticed, even though node was inserted by a looping construct');
  insertions.push($(insertion).clone()[0]);
  wasClicked = false;

  react.changed(insertions);
  $(node).find('.insertion').click();
  ok(wasClicked, 'click was noticed after list changed and contents of loop results node were updated');
});

test('anchors are not followed for contained nodes of an input node', function(){
  var innerNode = $('<span react="contain foo, attr \'foo\' foo">original</span>')[0];
  var innerNodeObject = {foo: 'inner anchor property'};
  react.anchor(innerNode, innerNodeObject);
  var outerNode = $('<span react="contain innerNode, attr \'foo\' foo"></span>')[0];
  var outerNodeObject = {innerNode: innerNode, foo:'outer anchor property'};
  react.anchor(outerNode, outerNodeObject);

  react.update(outerNode);
  same(innerNode.innerHTML, 'original', 'substitution in contained node did not get updated for update of outer node');
  react.update(outerNode);
  same(innerNode.innerHTML, 'original', 'substitution in contained node stil did not get updated for update of outer node, even after having been contained already at update time');
  react.update(innerNode);
  same($(innerNode).attr('foo'), 'inner anchor property', 'attr substitution for directive following the \'contain\' directive does inherit previous directive\'s scope chain');
  delete innerNodeObject.foo;
  react.update(innerNode);
  same(innerNode.innerHTML, '', 'substitution in contained node does not inherit containing scope');
  same($(innerNode).attr('foo'), 'inner anchor property', 'attr substitution for directive following the \'contain\' directive does inherit previous directive\'s scope chain');
});

test('anchored nodes within root get operated on, even if root does not', function(){
  var subNode = $('<span react="contain foo"></span>')[0];
  react.anchor(subNode, {foo: 'bar'});
  react.update($('<div></div>').html(subNode)[0]);
  same(subNode.innerHTML, 'bar', 'foo did not get updated');
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


/*
 * changed
 *
 */

test('regression test - values at various depths are correctly bound and updated when dot syntax was used', function(){
  // https://github.com/marcusphillips/react/issues/2
  nodes.$neighborsPoints.anchor(scopes.alice);
  scopes.alice.set('points', 1);
  scopes.alice.neighbor.set('points', 10);
  scopes.alice.neighbor.neighbor.set('points', 100);
  scopes.alice.neighbor.neighbor.neighbor.set('points', 1000);
  same(nodes.$neighborsPoints.children().map(function(){return $(this).html();}).join(','), '1,10,100,1000', 'correct values set at all levels');
});

}());
