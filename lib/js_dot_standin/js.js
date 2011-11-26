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
      this.error.apply(this, Array.prototype.slice.call(arguments, 1));
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

  tryIf: function(condition, block, onError){
    if(!condition){ return block(); }
    try{
      return block();
    } catch (error) {
      onError(error);
      throw error;
    }
  },


  // language primitives

  defaulted: function(value, alternative){
    return typeof value === 'undefined' ? alternative : value;
  },

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

  hasKeys: function(object){
    for(var key in object){ return true; }
    return false;
  },

  isArray: function(input){
    return Object.prototype.toString.call(input) === '[object Array]';
  },


  // regexen

  matchers: {
    leadingOrTrailingSpace: /(^\s+)|(\s+$)/
  },


  // strings

  trim: function(string){
    return string.replace(this.matchers.leadingOrTrailingSpace, '');
  },


  // function decorators

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
    var copy = js.isArray(seed) ? [] : typeof seed === 'object' || typeof seed === 'function' ? {} : seed;
    return js.extend(copy, seed);
  },


  // arrays

  last: function(array){
    return array[array.length-1];
  },

  among: function(haystack, needle){
    if(haystack.indexOf){
      return haystack.indexOf(needle) !== -1;
    }
    for ( var i = 0, length = haystack.length; i < length; i++ ) {
      if(haystack[i] === needle){
        return true;
      }
    }
    return false;
  },

  makeArrayLike: function(target){
    var arrayMethods = 'concat join pop push reverse shift slice sort splice unshift'.split(' ');
    for(var i = 0; i < arrayMethods.length; i++){
      (function(key){
        target[key] = function(){ return Array.prototype[key].apply(this, arguments); };
      }(arrayMethods[i]));
    }
  },


  // iteration

  keys: function(object){
    var keys = [];
    for(key in object){
      keys.push(key);
    }
    return keys;
  },

  toArray: function(object){
    var array = [];
    for(var key in object){
      array.push(object[key]);
    }
    return array;
  },

  map: function(collection, block){
    var result = ('length' in collection) ? [] : {};
    js.each(collection, function(which, item){
      result[which] = block(which, item);
    });
    return result;
  },

  each: function(collection, block){
    return (('length' in collection) ? js.inOrder : js.allKeys)(collection, block);
  },

  exhaust: function(source, block){
    var repeatLimit = 100000;
    while(js.hasKeys(source)){
      js.errorIf(!(repeatLimit--), 'this object is hard to exhaust of keys...');
      for(var key in source){
        block.call({}, key, source);
        delete source[key];
      }
    }
  },

  inOrder: function(collection, block){
    for(var which = 0; which < collection.length; which++){
      block(which, collection[which]);
    }
  },

  allKeys: function(collection, block){
    for(var key in collection){
      block(key, collection[key]);
    }
  },

  reduce: function(collection, memo, callback){
    js.each(collection, function(which, item){
      memo = callback(which, item, memo);
    });
    return memo;
  },

  filter: function(array, callback){
    callback || (callback = js._rejectFalseys);
    var result = [];
    for(var i = 0, length = array.length; i < length; i++){
      if(callback(i, array[i])){
        result.push(array[i]);
      }
    }
    return result;
  },

  _rejectFalseys: function(index, item){ return !!item; },


  // extras

  util: {
    unique: function(namespace){
      namespace = js.defaulted(namespace, '');
      return namespace + (js.util.unique.used[namespace] = (js.util.unique.used[namespace] || 0) + 1);
    }
  }

};

js.util.unique.used = {};

js.util.unique.reset = function(namespace){
  delete js.util.unique.used[namespace];
};


window.js = window.js || js;

}());
