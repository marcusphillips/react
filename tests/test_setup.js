(function(){

var global = (function(){return this;}());

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
    global[key] = scopes[key];
  }
};

QUnit.testDone = function(){
  $('#qunit-fixture')[0].innerHTML = '';
  $('#qunit-fixture')[0].innerHTML = '';
};




/*
 * helpers
 */

var throws = global.throws = function(block, description){
  var didThrow = false;
  try{
    block();
  } catch (error) {
    didThrow = true;
  }
  ok(didThrow, description);
};


}());
