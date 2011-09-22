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
      js.errorIf(nodes[key], 'Two fixture nodes have the same name, "'+key+'"');
      $(node).attr('data-fixture', key);
      nodes['$'+key] = window['$'+key] = $(node);
      nodes[key] = node;
    });
  }
};

/*
 * For each test
 */
QUnit.testStart = function(){
  refreshNodes();
  scopes = makeFixtures();
  // make all scope objects available in the global scope
  for(var key in scopes){
    window[key] = scopes[key];
  }
};

QUnit.testDone = function(){
  $('#qunit-fixture')[0].innerHTML = '';
  $('#qunit-fixture')[0].innerHTML = '';
  react.reset();
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
  throws(function(){ $broken.anchor({}); }, 'throws at nonexistent command');
});

test('calling update returns the root', function(){
  ok(react.update($inert[0], {}) === $inert[0], 'same node was returned');
});

test('calling update with a jQuery object returns the same object', function(){
  ok($inert.anchor({}) === $inert, 'same jQuery object was returned');
});

test('keys can use dot operator', function(){
  equal($addressDotStreet.anchor(alice).html(), 'cornell', 'key resolved while using a dot operator');
});

test('reactive nodes need not be at the top level', function(){
  $inert.html($name).anchor(alice);
  equal($name.html(), 'alice', 'the child node got the appropriate content');
});

test('rendering to nodes that are nested in others still works, an additional layer deep', function(){
  $inert.html($inert2);
  $inert2.html($name).anchor(alice);
  equal($name.html(), 'alice', 'the child node got the appropriate content');
});

/*
 *  containing
 */

module("contain");

test('containing strings', function(){
  equal($containingStringLiteral.anchor(inert).html(), 'example', 'contain directive inserted a string');
});

test('containing variables', function(){
  equal($name.anchor(alice).html(), 'alice', 'contain directive inserted a string variable');
  alice.set('name', 'alison');
  same($name.html(), 'alison', 'new name is inserted');
  alice.del('name');
  same($name.html(), '', 'deleting a property of an anchored scope causes a rerender');
});

test('containing node variables', function(){
  ok($containingWidget.anchor({widget:$inert[0]}).children()[0] === $inert[0], 'contain directive inserted a node variable');
});

test('containing react nodes', function(){
  $containingWidget.anchor({widget:$name[0], name:'nobody'});
  equal($name.html(), 'orig', 'react directive of contained node was not followed');
});


/*
 * attributes
 */

module("attributes");

test('setting string attributes', function(){
  equal($withAttributesFromStrings.anchor(inert).attr('name'), 'value', 'attribute was written correctly');
});

test('substituting variables in attribute names', function(){
  equal($withDynamicAttributeName.anchor(alice.car).attr('chitty'), 'value', 'attribute was written correctly');
});

test('substituting variables in attribute names', function(){
  equal($withDynamicAttributeValue.anchor(alice.car).attr('name'), '$4000', 'attribute was written correctly');
});

test('substituting variables in attribute values', function(){
  equal($mugshot.anchor(alice).attr('src'), 'example.com', 'attribute was written correctly');
});

/*
 *  conditionals
 */

module("conditionals");

test('conditional display', function(){
  equal($adminIcon.anchor(bob).css('display'), 'none', 'node is hidden when key is false');
  equal($adminIcon.anchor(alice).css('display') || 'block' /*chrome returns an empty string for default display value*/, 'block', 'node is shown again when key is changed to true');
});

test('conditional visibility', function(){
  equal($verifiedBadge.anchor(hacker).css('visibility'), 'hidden', 'node is invisible when key is false');
  equal($verifiedBadge.anchor(bob).css('visibility'), 'visible', 'node is visible again when key is changed to true');
});

test('conditional classes', function(){
  var originalClassRemains = function(){ return $adminIcon.hasClass('icon'); };
  ok(originalClassRemains() && !$adminIcon.anchor(bob).hasClass('active'), 'class was not added when condition is false');
  ok(originalClassRemains() && $adminIcon.anchor(alice).hasClass('active'), 'class was added when condition is true');
  ok(originalClassRemains() && !$adminIcon.anchor({}).hasClass('active'), 'class was removed when condition is undefined');
  ok(originalClassRemains());
});

test('no non-string classes', function(){
  ok(!$('<div react="classIf \'true\' number"></div>').anchor({number:5}).hasClass('5'), 'numeric class gets ignored');
});

test('conditionally adding attributes', function(){
  equal($adminIcon.anchor(alice).attr('data-admin'), 'true', 'attribute was added when condition is true');
  equal($adminIcon.anchor(hacker).attr('data-admin'), undefined, 'attribute was not added when condition is false');
  equal($adminIcon.anchor(bob).attr('data-admin'), undefined, 'attribute was not added when condition is undefined');
  equal($adminIcon.anchor(alice).attr('data-admin'), 'true', 'attribute was re-added when condition is true');
});


test('conditions can be negated', function(){
  equal($adminIcon.anchor(bob).attr('data-user'), 'true', 'attribute was added when negated condition is false');
  ok($('<div react="classIf ! condition \'activated\'"/>').anchor({condition:false}).hasClass('activated'), 'with a space, attribute was added when negated condition is false');
});

test('if directives turn off recursion in subsequent directives of the same node', function(){
  equal($adminEmail.attr('data-email'), 'orig', 'node starts out with original value');
  equal($adminEmail.anchor(alice).attr('data-email'), 'alice@startup.com', 'contents get set when condition is true');
  equal($adminEmail.anchor(bob).attr('data-email'), 'alice@startup.com', 'contents went unchanged when condition is false');
  bob.set('isAdmin', true);
  equal($adminEmail.attr('data-email'), 'bob@webmail.com', 'contents changed when property was updated to true');
});

test('if directives turn off recursion in child nodes', function(){
  react.update($adminEmail, alice);
  equal($adminEmailLink.html(), 'alice@startup.com', 'contents get set when condition is true');
  $adminEmail.anchor(bob);
  equal($adminEmailLink.html(), 'alice@startup.com', 'contents went unchanged when condition is false');
  bob.set('isAdmin', true);
  equal($adminEmailLink.html(), 'bob@webmail.com', 'contents changed when property was updated to true');
});


/*
 * looping
 */

module("within");

test('requires at least an item template node and a contents node inside the loop node', function(){
  throws(function(){ $containerlessLoop.anchor([]); }, 'omitting second loop child is not allowed');
});

test('template node is not visible after render', function(){
  $('#qunit-fixture').html($friends);
  ok($friends.itemTemplate().is(':visible'), 'template started out visible');
  ok($friends.anchor(charlie.friends).itemTemplate().is(':not(:visible)'), 'template was no longer visible');
});

test('can loop across values in an array', function(){
  equal($friends.anchor(charlie.friends).items().length, 2, 'results container node contains appropriate number of child elements');
  same($friends.items().map(function(){return $(this).attr('data-name');}).join(','), 'alice,bob', 'children\'s innerHTML is set to array items\' contents');
});

test('does not operate on loop item template node', function(){
  equal($friends.anchor(charlie.friends).itemTemplate().attr('data-name'), 'orig', 'item template was unchanged');
});

test('does not operate on descendants of loop item template node', function(){
  $friends.anchor(charlie.friends);
  equal($friendName.html(), 'orig', 'item template was unchanged');
});

test('does not operate on descendants of loop item template node, even when loop item template has no react attribute', function(){
  $navItems.anchor(navItems);
  same($navItemText.html(), 'orig', 'the contained node\'s directives were ignored');
});

test('calling changed on a subobject that\'s associated with a within directive does not attempt to rerender all directives on the node', function(){
  $businessStreet.anchor(alice);
  same($businessStreet.attr('name'), 'alice', 'attr came from outer prop');
  same($businessStreet.html(), 'main', 'contents came from inner prop');
  alice.name = 'alison';
  alice.business.set('address', {street:'huffington'});
  same($businessStreet.attr('name'), 'alice', 'attr was not changed');
  same($businessStreet.html(), 'huffington', 'contents got updated');
});

test('can loop across keys in an array', function(){
  same($indexIterator.anchor(charlie.friends).items().map(function(){return this.innerHTML;}).join(','), '0,1', 'children\'s innerHTML is set to array key\'s contents');
});

// doesnt need refactor, being replaced
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
  var originalChildren = $navItems.anchor(['a', 'b']).items();
  var updatedChildren = $navItems.anchor(['c', 'd']).items();
  for(var i = 0; i < 2; i++){
    ok(originalChildren[i], 'found a dom node in position '+i);
    ok(originalChildren[i] === updatedChildren[i], 'dom node '+i+' was reused');
  }
});

test('loops can be changed()', function(){
  var testItems = function(){
    equal($shopping.anchor(shopping).items().map(function(){ return $(this).html(); }).join(','), shopping.join(','), 'dom nodes contain expected value');
    equal($shopping.items().length, shopping.length, 'list item length is the same as dom node count');
  };

  $shopping.anchor(shopping);
  testItems();
  shopping.push('coffee');
  react.changed(shopping);
  testItems();
  shopping.pop();
  shopping.pop();
  react.changed(shopping);
  testItems();
});


/*
 * withinEach
 */

module("withinEach");

test('looping several times on different sized arrays results in different amounts of result contents nodes', function(){
  same([alice.friends.length, bob.friends.length, charlie.friends.length, david.friends.length, ellen.friends.length], [0,1,2,3,4]);
  same($withinFriends.anchor(bob.friends).items().length, 1, '2 children for inital render');
  same($withinFriends.anchor(david.friends).items().length, 3, '3 children for inital render');
  same($withinFriends.anchor(charlie.friends).items().length, 2, '2 children for inital render');
  same($withinFriends.anchor(alice.friends).items().length, 0, '2 children for inital render');
  same($withinFriends.anchor(ellen.friends).items().length, 4, '4 children for inital render');
});

test('withinEach implies a within statement on item nodes', function(){
  same($friends.anchor(charlie.friends).items().map(function(){ return $(this).attr('data-name'); }).join(','), 'alice,bob', 'children took their values from item objects\' foo properties');
  charlie.friends[0].set('name', 'ann');
  same($friends.items().eq(0).children().html(), 'ann', 'regression test: withinItem directive still applies after change event');
});

test('nested withinEachs', function(){
  same($ticTacToe.anchor(ticTacToe).items().first().items().first().attr('data-symbol'), 'x', 'doubly nested children took their values from item objects\' foo properties');
});

/*
 * within
 */

module("within");

test('scope can be shifted within a property', function(){
  ok( bob.pet.alergy === 'chocolate' &&
   'alergy' in alice.pet && alice.pet.alergy === undefined &&
    !('alergy' in charlie.pet)
  );
  equal($petAlergy.anchor(alice).html(), '', 'key did not fall through when local key is in object, but undefined');
  equal($petAlergy.anchor(bob).html()  , 'chocolate', 'content was correct from within a subobject');
  equal($petAlergy.anchor(charlie).html(), '', 'key fell through fell through to next higher scope when local key is missing');
});

test('within directive works well with changed method', function(){
  $addressCard.anchor(alice);
  same($street.html(), 'cornell', 'street gets set');
  alice.set('street', 'promenade');
  same($street.html(), 'cornell', 'address stays the same because it\'s looking at .address.street, not on .street');
  alice.address.set('street', 'ashbury');
  same($street.html(), 'ashbury', 'when address\'s street changes, the output changes');
});

test('within directive doesn\'t halt updates to the changed loop', function(){
  // regression test: https://github.com/marcusphillips/react/issues/3
  $multipleWithins.anchor(alice);
  $(alice.address.set('street', 'ashbury'));
  same($firstDescendant.html(), 'ashbury', 'first descendant gets set');
  same($secondDescendant.html(), 'ashbury', 'second descendant gets set');
});


/*
 * function properties
 */

test('functions get evaluated, with correct context', function(){
  same($popularity.anchor(charlie).html(), '2', 'function result was inserted, with this keyword resolving correctly');
});

test('functions bound at loop time evaluate in correct context', function(){
  same($shopping.anchor(['a', function(){return this[0];}]).items().map(function(){ return $(this).html() }).join(','), 'a,a', 'children\'s innerHTML is set to array key\'s contents');
});

test('functions can be used as namespaces without running', function(){
  same($addressDotStreet.anchor({
    address: js.extend(js.error, {
      street: 'cornell'
    })
  }).html(), 'cornell', 'function result was inserted');
});


/*
 * anchor
 */

module('anchor');

test('can name objects', function(){
  react.name('visitor', alice);
  ok(react.scopes.visitor === alice, 'react.scopes held the specified object at the specified name');
});

test('anchored nodes are prepended to scope chains on render', function(){
  equal($visitorName.anchor({}).html(), 'alice', 'inner node had access to outer node\'s anchor object');
});

test('anchored nodes re-render on object change', function(){
  alice.anchor($name).anchor($username).set({name: 'alison', username: 'crazygrrl'});
  same([$name.html(), $username.html()], ['alison','crazygrrl'], 'anchored nodes were updated when relevant object was changed');
});

test('changing values on an anchored object results in automatic change to the view for class properties', function(){
  ok($name.anchor(alice).hasClass('ms'), 'node got correct first class');
  alice.set('title', 'mrs');
  ok(!$name.hasClass('ms'), 'node does not have first class anymore');
  ok($name.hasClass('mrs'), 'node got correct second class');
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

test('changing dom or object strucutre invalidates change propogation to the view', function(){
  $addressCard.anchor(alice).html('');
  alice.address.set('street', 'oak');
  same($street.html(), 'cornell', 'the property linked to the replaced object was not re-rendered');
  $addressCard.html($street);
  alice.address.set('street', 'ashbury');
  same($street.html(), 'ashbury', 'the property linked to the replaced object was re-rendered after the object was put back');
  var oldAddress = alice.address;
  alice.address = bob.address;
  oldAddress.set('street', 'irrelevant');
  same($street.html(), 'ashbury', 'the property linked to the replaced object was not re-rendered');
  alice.address = oldAddress;
  alice.address.set('street', '5th');
  same($street.html(), '5th', 'the property linked to the replaced object was re-rendered after the object was put back');
});


/*
 * changed
 *
 */

test('regression test - values at various depths are correctly bound and updated when dot syntax was used', function(){
  // https://github.com/marcusphillips/react/issues/2
  $neighborsPoints.anchor(alice);
  alice.set('points', 1);
  alice.neighbor.set('points', 10);
  alice.neighbor.neighbor.set('points', 100);
  alice.neighbor.neighbor.neighbor.set('points', 1000);
  same($neighborsPoints.children().map(function(){return $(this).html();}).join(','), '1,10,100,1000', 'correct values set at all levels');
});

}());
