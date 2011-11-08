(function(){

var $originalFixtureNodes, nodes, scopes;

react.debug();

react.integrate.jQuery();

$(function(){
  $originalFixtureNodes = $('#fixture-nodes').remove();
});

for(var key in {'join':1}){
  jQuery.fn[key] = jQuery.fn[key] || Array.prototype[key];
}




/*
 * For each test
 */

// clones new fixture nodes from those found in tests/index.html
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
    }).end().html('');
  }
};

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
  $adminEmail.anchor(alice);
  equal($adminEmailLink.html(), 'alice@startup.com', 'contents get set when condition is true');
  $adminEmail.anchor(bob);
  equal($adminEmailLink.html(), 'alice@startup.com', 'contents went unchanged when condition is false');
  bob.set('isAdmin', true);
  equal($adminEmailLink.html(), 'bob@webmail.com', 'contents changed when property was updated to true');
});




/*
 * looping
 */

module("looping");

test('template node is not visible after render', function(){
  ok($friends.appendTo('#qunit-fixture').itemTemplate().is(':visible'), 'template started out visible');
  ok($friends.anchor(charlie.friends).itemTemplate().is(':not(:visible)'), 'template was no longer visible');
});

test('can loop across values in an array', function(){
  same($friends.anchor(charlie.friends).items().map(function(){return $(this).attr('data-name');}).join(','), 'alice,bob', 'children\'s innerHTML is set to array items\' contents');
});

test('can loop across keys in an array', function(){
  same($indexIterator.anchor(charlie.friends).items().map(function(){return this.innerHTML;}).join(','), '0,1', 'children\'s innerHTML is set to array key\'s contents');
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
  same($withinFriends.anchor(bob.friends).items().length, 1, '1 child for inital render');
  same($withinFriends.anchor(david.friends).items().length, 3, '3 children for inital render');
  same($withinFriends.anchor(charlie.friends).items().length, 2, '2 children for inital render');
  same($withinFriends.anchor(alice.friends).items().length, 0, '0 children for inital render');
  same($withinFriends.anchor(ellen.friends).items().length, 4, '4 children for inital render');
});

test('nested withinEachs', function(){
  same($ticTacToe.anchor(ticTacToe).item(0).item(0).attr('data-symbol'), 'x', 'doubly nested children took their values from item objects\' foo properties');
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

test('calling changed on a subobject that\'s associated with a within directive does not attempt to rerender all directives on the node', function(){
  same($businessStreet.anchor(alice).attr('name'), 'alice', 'attr came from outer prop');
  same($businessStreet.html(), 'main', 'contents came from inner prop');
  alice.name = 'alison';
  alice.business.set('address', {street:'huffington'});
  same($businessStreet.attr('name'), 'alice', 'attr was not changed');
  same($businessStreet.html(), 'huffington', 'contents got updated');
});

test('a call to within that fails makes branch invisible and unrendered', function(){
  delete alice.address;
  alice.street = 'broken';
  ok($addressCard.anchor(alice).children().html() === 'orig', 'street node went unchanged, as it is contained inside a within statement that failed lookup');
  ok($addressCard.hasClass('reactConditionallyHidden'), 'street node was hidden');
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
  ok(react.name('visitor', alice) === alice, 'naming a scope returns the scope');
  ok(react.scopes.visitor === alice, 'react.scopes held the specified object at the specified name');
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
  $post.anchor(alice, posts.havingFun);
  same([$post.hasClass('adminPost'), $post.hasClass('published')], [true, true], 'anchored nodes was initialized correctly');
  posts.havingFun.isPublished = false;
  alice.set('isAdmin', false);
  same([$post.hasClass('adminPost'), $post.hasClass('published')], [false, true], 'anchored node was updated when relevant object was changed, but not for properties on objects not notified of change');
});

test('updating anchored nodes does not revisit all nodes', function(){
  $post.anchor(alice);
  ok($post.hasClass('adminPost'), 'foo starts out at 1');
  ok($post.hasClass('verifiedPost'), 'bar starts out at 1');
  alice.isVerified = false;
  alice.set('isAdmin', false);
  ok(!$post.hasClass('adminPost'), 'for anchored nodes, properties that are set using react.set() get autmatically updated');
  ok($post.hasClass('verifiedPost'), 'properties changed manually are not rerendered');
});

test('anchored nodes do not inherit parent scope', function(){
  $userImage.anchor({}); // user has no 'deleted' key
  $blogPost.anchor({deleted: true})
  ok(!$userImage.hasClass('deleted'));
});

test("anchored nodes aren't visited in updates to parent nodes", function(){
  $userImage.anchor(alice); // alice has no 'deleted' key
  alice.deleted = true; // but in this contrived example, we don't want it to be updated yet
  $blogPost.anchor({});
  ok(!$userImage.hasClass('deleted'));
});



/*
 * changed
 */

test('calling changed on an array updates associated list items', function(){
  same($shopping.anchor(shopping).item(0).html(), 'cheese', 'item substitution starts out as foo');
  shopping.set(0, 'fruit');
  same($shopping.item(0).html(), 'fruit', 'item substitution got changed');
});

test('loop items get bound to their indices', function(){
  $shopping.anchor(react.helpers(['a', 'b']));
  same($shopping.item(1).html(), 'b', 'substitution starts out as b');
  $shopping.anchor().set(1, 'bPrime');
  same($shopping.item(1).html(), 'bPrime', 'substitution gets set to b prime');
});

test('can anchor in update operation with three arguments', function(){
  $name.anchor(alice);
  alice.name = 'alison';
  same($name.anchor(alice).html(), 'alison', 'node got the new value from the anchored object');
});

test('anchors are not followed for contained nodes of an input node', function(){
  $name.anchor(alice).anchor().name = 'alison';
  var app = react.helpers({widget: $name, name:'MyApp'});
  var $outer = $('<span react="contain widget"></span>').anchor(app);
  same($name.html(), 'alice', 'substitution in contained node did not get updated for update of outer node');
  app.changed();
  same($name.html(), 'alice', 'substitution in contained node stil did not get updated for update of outer node, even after having been contained already at update time');
  alice.changed();
  same($name.attr('name'), 'alison', 'attr substitution for directive following the \'contain\' directive does inherit previous directive\'s scope chain');
  alice.del('name');
  same($name.html(), '', 'substitution in contained node does not inherit containing scope');
  same($name.attr('name'), 'alison', 'attr substitution for directive following the \'contain\' directive does inherit previous directive\'s scope chain');
});

test('nodes with no directives propogate updates to their children', function(){
  var $nodeToInheritFrom = $('<div />').anchor({foo: 'bar'});
  var $nodeThatWantsToInherit = $('<span react="contain foo">orig</span>');
  var $nodeWithoutDirectives = $('<div />').html($nodeThatWantsToInherit);
  react.update($nodeWithoutDirectives);
  // same($nodeThatWantsToInherit.html(), 'bar', 'foo did not get updated');  //todo: fix this bug
});

test('unanchored nodes can have properties set with no side effects', function(){
  react.update($name, alice);
  alice.set('name', 'alison');
  same($name.html(), 'alice', 'even after notifying react of the change to the object with .set(), property changes do not result in rerenders');
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
 * regression tests
 */

test('a withinEach inside a for will not get duplicate bindings', function(){
  // regression test
  var matrix = [[]];
  react.set(matrix, 0, [{}, {}]);
  var $forContainingWithinEach = $('\
    <div react="for which item">\
      <div react="within item, withinEach">\
        <span react="contain which"></span>\
      </div>\
    </div>\
  ').anchor(matrix);
  same($forContainingWithinEach.item(0).item(0).html(), '0', 'there is only one element in the outer array, so index substitution (binding to the key "which") should always be 0');
  react.set(matrix, 0, [{}, {}]);
  // before the bug fix, the binding instruction from the outer 'for' directive never got blown away as the scope chain got built up
  // thus, there would have been an extra key binding scope, instead of the normal withinEach style scope change into a property
  same($forContainingWithinEach.item(0).item(0).html(), '0', 'index substitution is still set to 0');
  react.set(matrix[0][1], 'which', 'bar');
  same($forContainingWithinEach.item(0).item(1).html(), 'bar', 'index substitution changes to the masking property');
});

test('regression test - values at various depths are correctly bound and updated when dot syntax was used', function(){
  // https://github.com/marcusphillips/react/issues/2
  var $neighborsPoints = $('\
    <div>\
      <div react="contain points">orig</div>\
      <div react="contain neighbor.points">orig</div>\
      <div react="contain neighbor.neighbor.points">orig</div>\
      <div react="contain neighbor.neighbor.neighbor.points">orig</div>\
    </div>\
  ');

  $neighborsPoints.anchor(alice);
  alice.set('points', 1);
  alice.neighbor.set('points', 10);
  alice.neighbor.neighbor.set('points', 100);
  alice.neighbor.neighbor.neighbor.set('points', 1000);
  same($neighborsPoints.children().map(function(){return $(this).html();}).join(','), '1,10,100,1000', 'correct values set at all levels');
});

test('index key binding is still available at change response time', function(){
  // regression test
  // this node needs to have an operating directive preceeded by 'within item'
  var $withinItemContainWhich = $('\
    <div react="for which item">\
      <div class="item" react="within item, contain which"></div>\
    </div>\
  ').anchor(people);
  same($withinItemContainWhich.item(1).html(), '1', 'which is available after an update operation');
  people.set(1, {});
  same($withinItemContainWhich.item(1).html(), '1', 'which is still available after a change response');
});

test('within directive doesn\'t halt updates to the changed loop', function(){
  // regression test: https://github.com/marcusphillips/react/issues/3
  var $multipleWithins = $('\
    <div>\
      <div react="within address">\
        <div id="firstDescendant" react="contain street">orig</div>\
      </div>\
      <div react="within address">\
        <div id="secondDescendant" react="contain street">orig</div>\
      </div>\
    </div>\
  ');
  $multipleWithins.anchor(alice);
  $(alice.address.set('street', 'ashbury'));
  same($multipleWithins.find('#firstDescendant').html(), 'ashbury', 'first descendant gets set');
  same($multipleWithins.find('#secondDescendant').html(), 'ashbury', 'second descendant gets set');
});

test('withinEach implies a within statement on item nodes', function(){
  // regression test
  same($friends.anchor(charlie.friends).items().map(function(){ return $(this).attr('data-name'); }).join(','), 'alice,bob', 'children took their values from item objects\' foo properties');
  charlie.friends[0].set('name', 'ann');
  same($friends.item(0).children().html(), 'ann', 'withinItem directive still applies after change event');
});

test('event handlers don\'t dissapear on call to changed()', function(){
  // regression test
  var $subnode = $('<div><div id="clicker">increment</div></div>');
  $subnode.find('#clicker').click(function(){
    object.set('foo', object.foo+1);
  });

  var object = react.helpers({foo:1, subnode:$subnode[0]});

  var $node = $('\
    <div>\
      <div id="foo" react="contain foo"></div>\
      <div react="contain subnode"></div>\
    </div>\
  ').anchor(object);

  same($node.find('#foo').html(), '1', 'foo got set');
  $subnode.find('#clicker').click();
  same($node.find('#foo').html(), '2', 'foo got updated');
  $subnode.find('#clicker').click();
  same($node.find('#foo').html(), '3', 'foo got updated after changed');
});

test('event handlers don\'t get lost by loop insertion or creation', function(){
  // regression test
  var wasClicked = false;

  var items = react.helpers([
    $inert.click(function(){ wasClicked = true; })[0]
  ]);

  $('\
    <div react="for item">\
      <div react="contain item"></div>\
    </div>\
  ').anchor(items);

  $inert.click();
  ok(wasClicked, 'click was noticed, even though node was inserted by a looping construct');

  wasClicked = false;

  items.push($inert2[0]);
  react.changed(items);
  $inert.click();
  ok(wasClicked, 'click was noticed after list changed and contents of loop results node were updated');
});

test('templates are not rerendered when inserted in to the dom', function () {
  // regression test
  $containingWidget.anchor(react.helpers({}));
  same($name.anchor(react.helpers({
    name: function(){
      didRun = true;
      return 'henry';
    }
  })).html(), 'henry', 'inner node exercised function');

  var didRun = false;
  $containingWidget.anchor().set('widget', $name);
  ok(!didRun, "function did not run, so inner node was not visited again");
});

}());
