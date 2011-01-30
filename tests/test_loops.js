module("loop");

test('works with a missing key alias', function(){/*...*/});

test('can loop across values in an array', function(){
  var node = $('<div id=\"outter\" mv="loop which item in list"><div id=\"template\" mv="contain item"></div><div id="container"></div></div>')[0];
  var itemTemplate = $(node).children()[0];
  var resultsHolder = $(node).children()[1];
  mv.update(node, {list:['a','b','c']});
  equal($(node).children().last().children().length, 3, 'results container node contains three child elements');
  same([
    $($(resultsHolder).children()[0]).html(),
    $($(resultsHolder).children()[1]).html(),
    $($(resultsHolder).children()[2]).html()
  ], ['a','b','c'], 'children\'s innerHTML is set to array items\' contents');
  equal($(itemTemplate).html(), '', 'item template was unchanged');
});

test('can loop across keys in an array', function(){
  var node = $('<div mv="loop which item in list">'
               + '<div mv="contain which">'
               + '</div>'
               + '<div></div>'
             + '</div>')[0];
  var resultsHolder = $(node).children()[1];
  mv.update(node, {list:['a','b','c']});
  same([
    $($(resultsHolder).children()[0]).html(),
    $($(resultsHolder).children()[1]).html(),
    $($(resultsHolder).children()[2]).html()
  ], ['0','1','2'], 'children\'s innerHTML is set to array key\'s contents');
});
