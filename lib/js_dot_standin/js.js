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

var js = function(input){
  each(js.normalizers, function(normalizer){ normalizer(input); });
};

extend(js, {

  // normalizers holds a list of changes to make to objects
  normalizers: [],

  // dev helpers

  noop: function(){},
  global: global,

  conditionalDebug: function(){
    if(js.debug){debugger;}
  },

  log: function(){
    if(typeof console !== 'undefined'){
      console.log.apply(console, arguments);
    }
  },

  error: function(message, supplementalData){
    if(supplementalData && supplementalData !== true && console && console.log && console.log.apply){
      console.log('supplemental data for error to follow:', supplementalData);
    };
    if(arguments[arguments.length-1] === true){
      debugger;
    } else {
      throw new Error(message);
    }
  },

  errorIf: function(condition, message){
    if(condition){
      js.error.apply(js, Array.prototype.slice.call(arguments, 1));
    }
  },

  debugIf: function(condition){
    if(condition){
      debugger;
    }
  },

  errorAndDebugIf: function(condition, message){
    js.debuggerIf(condition);
    js.errorIf(condition, message);
  },

  catchIf: function(condition, block, onError, context){
    context || (context = this);
    if(!condition){ return block.call(context); }
    try{
      return block.call(context);
    } catch (error) {
      return onError.call(context, error);
    }
  },

  // this utility puts a debugger statement into the write flow for any object's property.
  // helpful when you're trying to figure out how a property got set to an unexpected value
  // example: js.debugAssignment(user, 'name');
  debugAssignment: function(object, key, condition, context){
    if(!object.__defineSetter__){ return; }
    var value;
    // todo: make this capable of replacing old setter and getter, rather than overwriting
    object.__defineGetter__(key, function(     ){ return value; });
    object.__defineSetter__(key, function(input){
      if(!condition || condition.apply(context || object, input)){ debugger; }
      return value = input;
    });
  },

  // language primitives

  defaulted: function(value, alternative){ return typeof value === 'undefined' ? alternative : value; },

  create: function(prototype, properties){
    var Constructor = function(){};
    Constructor.prototype = prototype;
    var result = new Constructor();
    if(typeof properties !== 'undefined'){
      for(var key in properties){
        result[key] = properties[key];
      }
    }
    return result;
  },

  isArray: function(input){
    return Object.prototype.toString.call(input) === '[object Array]';
  },


  // regexen

  matchers: {
    leadingOrTrailingSpace: /(^\s+)|(\s+$)/
  },


  // strings

  trim: function(string){ return string.replace(js.matchers.leadingOrTrailingSpace, ''); },


  // function decorators

  curry: function(fn){
    var curriedArgs = js.slice(arguments, 1);
    return function(){
      var inputArgs = js.slice(arguments);
      return fn.apply(this, js.map(curriedArgs, function(curriedArg){
        return curriedArg === undefined ? inputArgs.shift() : curriedArg;
      }).concat(inputArgs));
    };
  },

  bind: function(fn, context){ return function(){ return fn.apply(context, arguments); }; },

  memoizing: function(fn){
    var result, hasRun;
    return function(){
      if(hasRun){ return result; }
      result = fn.result = fn.apply(this, arguments);
      hasRun = fn.hasRun = true;
      return fn.result;
    };
  },


  // properties and object capabilities

  // has is a safer version of the 'in' operator
  has:  function(object, key){ return !!object && typeof object === 'object' && (key in object); },
  owns: function(object, key){ return !!object && typeof object === 'object' && object.hasOwnProperty(key); },

  prop: function(object, key, val){ return object ? js[arguments.length === 2 ? 'get' : 'set'].apply(this, arguments) : object; },
  get:  function(object, key){ return object[key]; },
  set:  function(object, key, val){
    object[key] = val;
    return object;
  },

  run:  function(object, methodName, args, context){ return js.exec(object[methodName], args, context || object); },
  exec: function(callable, args, context){ return callable.apply(context || js.global, args || []); },
  del:  function(object, keys){
    js.each(isArray(keys) ? keys : [keys], function(key){ delete object[key]; });
    return object;
  },


  // objects

  extend: extend,

  copy: function(seed){
    var copy = js.isArray(seed) ? [] : js.among(typeof seed, ['object', 'function']) ? {} : seed;
    return js.extend(copy, seed);
  },


  // arrays

  slice: function(collection){ return arraySlice.call(collection, arraySlice.call(arguments, 1)); },

  last: function(array){ return array[array.length-1]; },

  makeArrayLike: function(target){
    var arrayMethods = 'concat join pop push reverse shift slice sort splice unshift'.split(' ');
    for(var i = 0; i < arrayMethods.length; i++){
      (function(key){
        target[key] = function(){ return Array.prototype[key].apply(this, arguments); };
      }(arrayMethods[i]));
    }
  },

  concatArrays: function(arrays){
    return js.reduce(arrays, [], function(memo, array){
      return memo.concat(array);
    });
  },


  // collections

  clear: function(target){
    js.each(target, function(item, which){
      delete item[which];
    });
  },

  hasKeys: function(object){
    for(var key in object){ return true; }
    return false;
  },

  keys: function(object){
    var keys = [];
    for(key in object){
      keys.push(key);
    }
    return keys;
  },

  among: function(needle, haystack){
    return haystack.indexOf ? haystack.indexOf(needle) !== -1 : js.reduce(haystack, false, function(memo, item){
      return memo || item === needle;
    });
  },


  // iteration

  // todo: add a hasOwnProperty skip test?
  _iterationSkipTests: [ function(item){ return item && item._boundFlag; } ],

  skipIteration: function(item, key, collection){
    // can't use higher-level iteration functions here, or we'll infinitely recurse
    for(var i = 0; i < js._iterationSkipTests.length; i++){
      if(js._iterationSkipTests[i].apply(collection, arguments)){ return true; }
    }
    return false;
  },

  toArray: function(arrayLikeObject){ return js.map(arrayLikeObject, function(item){ return item; }); },

  each: function(collection, block, context){
    js.errorIf(!collection, 'tried to iterate over a falsey value');
    return (('length' in collection) ? js.inOrder : js.allKeys)(collection, block, context);
  },

  inOrder: function(collection, block, context){
    block = js._normalizeIterationBlock(block);
    for(var which = 0; which < collection.length; which++){
      if(js.skipIteration(collection, collection[which], which)){ continue; }
      block.call(context || collection, collection[which], which);
    }
    return collection;
  },

  allKeys: function(collection, block, context){
    block = js._normalizeIterationBlock(block);
    for(var key in collection){
      if(js.skipIteration(collection, collection[key], key)){ continue; }
      block.call(context || collection, collection[key], key);
    }
    return collection;
  },

  reduce: function(collection, memo, block, context){
    block = js._normalizeIterationBlock(block);
    js.each(collection, function(item, which){
      memo = block.call(context || collection, memo, item, which);
    });
    return memo;
  },

  map: function(collection, block, context){
    block = js._normalizeIterationBlock(block);
    var result = ('length' in collection) ? [] : {};
    js.each(collection, function(item, which){
      result[which] = block.call(context || collection, item, which);
    }, context);
    return result;
  },

  exhaust: function(source, block, context){
    var repeatLimit = 100000;
    block = js._normalizeIterationBlock(block);
    while(js.hasKeys(source)){
      js.errorIf(!(--repeatLimit), 'could not exhaust source object in '+ repeatLimit +' iterations', {source: this._directives});
      js.each(source, function(item, key){
        block.apply(this, arguments);
        delete source[key];
      }, context);
    }
  },

  filter: function(array, block, context){
    block = js._normalizeIterationBlock(block);
    return js.reduce(array, [], function(memo, item, index){
      return (block || js._rejectFalseys).call(context || array, item, index) ? memo.concat([item]) : memo;
    });
  },

  _rejectFalseys: function(item){ return !!item; },

  // if the input is a string, make a generator function that returns the property at that key
  // if the input is an array, use the first element as a method name, and use the second argument as an arguments array
  _normalizeIterationBlock: function(input){
    var type = typeof input;
    return (
      js.isArray(input) ? function(item){ return item[input[0]].apply(item, input[1] || []); } :
      type === 'string' ? function(item){ return item[input]; } :
      input
    );
  },


  // extras

  unique: function(namespace){
    namespace || (namespace = '');
    return namespace + (js.unique.used[namespace] = (js.unique.used[namespace] || 0) + 1);
  }

});

js.extend(js.unique, {
  used: {},
  reset: function(namespace){ delete js.unique.used[namespace]; }
});


js.each({
  prop: 'accessor',
  get:  'getter',
  set:  'setter',
  run:  'runner',
  exec: 'executer',
  del:  'deleter'
}, function(generatorName, methodName){
  js[generatorName] = function(object){
    return js.curry(js[methodName], object);
  };
});


// classes

js.Set = function(getKey){
  getKey && (this._getKey = getKey);
  js.extend(this, { _items: {} });
};

js.extend(js.Set.prototype, {
  _getKey: function(){ throwError('You must define a getKey operation'); }, // todo: provide a default getKey function
  add: function(item){ this._items[this._getKey(item)] = item; },
  remove: function(item){ delete this._items[this._getKey(item)]; },
  contains: function(item){ return this._getKey(item) in this._items; },
  each: function(block, context){ return js.each(this._items, block, context); },
  exhaust: function(block, context){ return js.exhaust(this._items, block, context); }
});


window.js = window.js || js;

}());
