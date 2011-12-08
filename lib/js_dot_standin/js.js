(function(undefined){

  var global = this;

  var arraySlice = Array.prototype.slice;

  function extend(target /*, source1, [... sourceN]*/){
    for(var whichArg = 1; whichArg < arguments.length; whichArg++){
      var source = arguments[whichArg];
      for(var key in source){
        target[key] = source[key];
      }
    }
    return target;
  }

  function js(input){
    each(normalizers, function(normalizer){ normalizer(input); });
  };


  // normalizers holds a list of changes to make to objects
  var normalizers = [];

  // dev helpers

  function noop(){};

  function conditionalDebug(){
    if(js.debug){debugger;}
  };

  function log(){
    if(typeof console !== 'undefined'){
      console.log.apply(console, arguments);
    }
  };

  function error(message, supplementalData){
    if(supplementalData && supplementalData !== true && console && console.log && console.log.apply){
      console.log('supplemental data for error to follow:', supplementalData);
    };
    if(arguments[arguments.length-1] === true){
      debugger;
    } else {
      throw new Error(message);
    }
  };

  function errorIf(condition, message){
    if(condition){
      error.apply(js, Array.prototype.slice.call(arguments, 1));
    }
  };

  function debugIf(condition){
    if(condition){
      debugger;
    }
  };

  function errorAndDebugIf(condition, message){
    debuggerIf(condition);
    errorIf(condition, message);
  };

  function catchIf(condition, block, onError, context){
    context || (context = this);
    if(!condition){ return block.call(context); }
    try{
      return block.call(context);
    } catch (error) {
      return onError.call(context, error);
    }
  };

  // this utility puts a debugger statement into the write flow for any object's property.
  // helpful when you're trying to figure out how a property got set to an unexpected value
  // example: debugAssignment(user, 'name');
  function debugAssignment(object, key, condition, context){
    if(!object.__defineSetter__){ return; }
    var value;
    // todo: make this capable of replacing old setter and getter, rather than overwriting
    object.__defineGetter__(key, function(     ){ return value; });
    object.__defineSetter__(key, function(input){
      if(!condition || condition.apply(context || object, input)){ debugger; }
      return value = input;
    });
  };

  // language primitives

  function defaulted(value, alternative){ return typeof value === 'undefined' ? alternative : value; };

  function create(prototype, properties){
    function Constructor(){};
    Constructor.prototype = prototype;
    var result = new Constructor();
    if(typeof properties !== 'undefined'){
      for(var key in properties){
        result[key] = properties[key];
      }
    }
    return result;
  };

  function isArray(input){
    return Object.prototype.toString.call(input) === '[object Array]';
  };


  // regexen

  var matchers = {
    leadingOrTrailingSpace: /(^\s+)|(\s+$)/
  };


  // strings

  function trim(string){ return string.replace(matchers.leadingOrTrailingSpace, ''); };


  // function decorators

  function curry(fn){
    var curriedArgs = slice(arguments, 1);
    return function(){
      var inputArgs = slice(arguments);
      return fn.apply(this, map(curriedArgs, function(curriedArg){
        return curriedArg === undefined ? inputArgs.shift() : curriedArg;
      }).concat(inputArgs));
    };
  };

  function bind(fn, context){ return function(){ return fn.apply(context, arguments); }; };

  function memoizing(fn){
    var result, hasRun;
    return function(){
      if(hasRun){ return result; }
      result = fn.result = fn.apply(this, arguments);
      hasRun = fn.hasRun = true;
      return fn.result;
    };
  };


  // properties and object capabilities

  // has is a safer version of the 'in' operator
  var has =  function(object, key){ return !!object && typeof object === 'object' && (key in object); };
  function owns(object, key){ return !!object && typeof object === 'object' && object.hasOwnProperty(key); };

  function prop(object, key, val){ return object ? js[arguments.length === 2 ? 'get' : 'set'].apply(this, arguments) : object; };
  var get =  function(object, key){ return object[key]; };
  var set =  function(object, key, val){
    object[key] = val;
    return object;
  };

  var run =  function(object, methodName, args, context){ return exec(object[methodName], args, context || object); };
  function exec(callable, args, context){ return callable.apply(context || global, args || []); };
  var del =  function(object, keys){
    each(isArray(keys) ? keys : [keys], function(key){ delete object[key]; });
    return object;
  };


  // objects

  function copy(seed){
    var copy = isArray(seed) ? [] : among(typeof seed, ['object', 'function']) ? {} : seed;
    return extend(copy, seed);
  };


  // arrays

  function slice(collection){ return arraySlice.call(collection, arraySlice.call(arguments, 1)); };

  function last(array){ return array[array.length-1]; };

  function makeArrayLike(target){
    var arrayMethods = 'concat join pop push reverse shift slice sort splice unshift'.split(' ');
    for(var i = 0; i < arrayMethods.length; i++){
      (function(key){
        target[key] = function(){ return Array.prototype[key].apply(this, arguments); };
      }(arrayMethods[i]));
    }
  };

  function concatArrays(arrays){
    return reduce(arrays, [], function(memo, array){
      return memo.concat(array);
    });
  };


  // collections

  function clear(target){
    each(target, function(item, which){
      delete item[which];
    });
  };

  function hasKeys(object){
    for(var key in object){ return true; }
    return false;
  };

  function keys(object){
    var keys = [];
    for(var key in object){
      keys.push(key);
    }
    return keys;
  };

  function among(needle, haystack){
    return haystack.indexOf ? haystack.indexOf(needle) !== -1 : reduce(haystack, false, function(memo, item){
      return memo || item === needle;
    });
  };


  // iteration

  // todo: add a hasOwnProperty skip test?
  var _iterationSkipTests = [ function(item){ return item && item._boundFlag; } ];

  function skipIteration(item, key, collection){
    // can't use higher-level iteration functions here, or we'll infinitely recurse
    for(var i = 0; i < _iterationSkipTests.length; i++){
      if(_iterationSkipTests[i].apply(collection, arguments)){ return true; }
    }
    return false;
  };

  function toArray(arrayLikeObject){ return map(arrayLikeObject, function(item){ return item; }); };

  function each(collection, block, context){
    errorIf(!collection, 'tried to iterate over a falsey value');
    return (('length' in collection) ? inOrder : allKeys)(collection, block, context);
  };

  function inOrder(collection, block, context){
    block = _normalizeIterationBlock(block);
    for(var which = 0; which < collection.length; which++){
      if(skipIteration(collection, collection[which], which)){ continue; }
      block.call(context || collection, collection[which], which);
    }
    return collection;
  };

  function allKeys(collection, block, context){
    block = _normalizeIterationBlock(block);
    for(var key in collection){
      if(skipIteration(collection, collection[key], key)){ continue; }
      block.call(context || collection, collection[key], key);
    }
    return collection;
  };

  function reduce(collection, memo, block, context){
    block = _normalizeIterationBlock(block);
    each(collection, function(item, which){
      memo = block.call(context || collection, memo, item, which);
    });
    return memo;
  };

  function map(collection, block, context){
    block = _normalizeIterationBlock(block);
    var result = ('length' in collection) ? [] : {};
    each(collection, function(item, which){
      result[which] = block.call(context || collection, item, which);
    }, context);
    return result;
  };

  function exhaust(source, block, context){
    var repeatLimit = 100000;
    block = _normalizeIterationBlock(block);
    while(hasKeys(source)){
      errorIf(!(--repeatLimit), 'could not exhaust source object in '+ repeatLimit +' iterations', {source: this._directives});
      each(source, function(item, key){
        block.apply(this, arguments);
        delete source[key];
      }, context);
    }
  };

  function filter(array, block, context){
    block = _normalizeIterationBlock(block);
    return reduce(array, [], function(memo, item, index){
      return (block || _rejectFalseys).call(context || array, item, index) ? memo.concat([item]) : memo;
    });
  };

  function _rejectFalseys(item){ return !!item; };

  // if the input is a string, make a generator function that returns the property at that key
  // if the input is an array, use the first element as a method name, and use the second argument as an arguments array
  function _normalizeIterationBlock(input){
    var type = typeof input;
    return (
      isArray(input) ? function(item){ return item[input[0]].apply(item, input[1] || []); } :
      type === 'string' ? function(item){ return item[input]; } :
      input
    );
  };


  // extras

  function unique(namespace){
    namespace || (namespace = '');
    return namespace + (unique.used[namespace] = (unique.used[namespace] || 0) + 1);
  };


  extend(unique, {
    used: {},
    reset: function(namespace){ delete unique.used[namespace]; }
  });


  // classes

  Set = function(getKey){
    getKey && (this._getKey = getKey);
    extend(this, { _items: {} });
  };

  extend(Set.prototype, {
    _getKey: function(){ throwError('You must define a getKey operation'); }, // todo: provide a default getKey function
    add: function(item){ this._items[this._getKey(item)] = item; },
    remove: function(item){ delete this._items[this._getKey(item)]; },
    contains: function(item){ return this._getKey(item) in this._items; },
    each: function(block, context){ return each(this._items, block, context); },
    exhaust: function(block, context){ return exhaust(this._items, block, context); }
  });


  // add public functions to interface
  extend(js, {allKeys:allKeys, among:among, bind:bind, catchIf:catchIf, clear:clear, concatArrays:concatArrays, conditionalDebug:conditionalDebug, copy:copy, create:create, curry:curry, debugAssignment:debugAssignment, debugIf:debugIf, defaulted:defaulted, del:del, each:each, error:error, errorAndDebugIf:errorAndDebugIf, errorIf:errorIf, exec:exec, exhaust:exhaust, extend:extend, filter:filter, get:get, global:global, has:has, hasKeys:hasKeys, inOrder:inOrder, isArray:isArray, keys:keys, last:last, log:log, makeArrayLike:makeArrayLike, map:map, memoizing:memoizing, noop:noop, owns:owns, prop:prop, reduce:reduce, run:run, Set:Set, set:set, slice:slice, toArray:toArray, trim:trim, unique:unique});
  each({
    prop: 'accessor',
    get:  'getter',
    set:  'setter',
    run:  'runner',
    exec: 'executer',
    del:  'deleter'
  }, function(generatorName, methodName){
    js[generatorName] = function(object){
      return curry(js[methodName], object);
    };
  });


  window.js = window.js || js;

}());
