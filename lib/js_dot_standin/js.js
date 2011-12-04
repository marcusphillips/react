(function(){

var js = {


  // dev helpers

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


  // objects

  extend: function(target /*, source1, [... sourceN]*/){
    for(var whichArg = 1; whichArg < arguments.length; whichArg++){
      var source = arguments[whichArg];
      for(var key in source){
        target[key] = source[key];
      }
    }
    return target;
  },

  copy: function(seed){
    var copy = js.isArray(seed) ? [] : js.among(typeof seed, ['object', 'function']) ? {} : seed;
    return js.extend(copy, seed);
  },


  // arrays

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

  toArray: function(arrayLikeObject){ return js.map(arrayLikeObject, function(item){ return item; }); },

  each: function(collection, block, context){
    return (('length' in collection) ? js.inOrder : js.allKeys)(collection, block, context);
  },

  inOrder: function(collection, block, context){
    block = js._normalizeIterationBlock(block);
    for(var which = 0; which < collection.length; which++){
      block.call(context || collection, collection[which], which);
    }
  },

  allKeys: function(collection, block, context){
    block = js._normalizeIterationBlock(block);
    for(var key in collection){
      block.call(context || collection, collection[key], key);
    }
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

  _normalizeIterationBlock: function(input){
    var type = typeof input;
    return (
      type === 'array'    ? function(item){ return item[input[0]].apply(item, input.slice(1)); } :
      type === 'string'   ? function(item){ return item[input](); } :
      input
    );
  },


  // extras

  unique: function(namespace){
    namespace || (namespace = '');
    return namespace + (js.unique.used[namespace] = (js.unique.used[namespace] || 0) + 1);
  }

};

js.extend(js.unique, {
  used: {},
  reset: function(namespace){ delete js.unique.used[namespace]; }
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
