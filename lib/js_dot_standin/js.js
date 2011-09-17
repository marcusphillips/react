var js = js || {

  conditionalDebug: function(){
    if(js.debug){debugger;}
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

  trim: function(string){
    return string.replace(this.matchers.leadingOrTrailingSpace, '');
  },

  log: function(){
    if(typeof console !== 'undefined'){
      console.log.apply(console, arguments);
    }
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

  map: function(collection, block){
    js.errorIf(typeof collection.length === 'undefined', 'js.map is currently written for arrays only');
    var result = [];
    for(var which = 0; which < collection.length; which++){
      result.push(block(which, collection[which]));
    }
    return result;
  },

  toArray: function(object){
    var array = [];
    for(var key in object){
      array.push(object[key]);
    }
    return array;
  },

  reduce: function(collection, memo, callback){
    js.map(collection, function(which, item){
      memo = callback(which, item, memo);
    });
    return memo;
  },

  matchers: {
    leadingOrTrailingSpace: /(^\s)|(\s$)/
  },

  last: function(array){
    return array[array.length-1];
  },

  filter: function(array, callback){
    var result = [];
    for(var i = 0, length = array.length; i < length; i++){
      if(callback(i, array[i])){
        result.push(array[i]);
      }
    }
    return result;
  },

  defaulted: function(value, alternative){
    return typeof value === 'undefined' ? alternative : value;
  },

  error: function(message, supplementalData){
    if(1 < arguments.length && console && console.log && console.log.apply){
      console.log('supplemental data for error to follow:', supplementalData);
    };
    throw new Error(message);
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

  util: {
    unique: function(namespace){
      namespace = js.defaulted(namespace, '');
      return namespace + (js.util.unique.used[namespace] = (js.util.unique.used[namespace] || 0) + 1);
    }
  },

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

  isArray: function(input){
    return Object.prototype.toString.call(input) === '[object Array]';
  },

  makeArrayLike: function(target){
    var arrayMethods = 'concat join pop push reverse shift slice sort splice unshift'.split(' ');
    for(var i = 0; i < arrayMethods.length; i++){
      (function(key){
        target[key] = function(){ return Array.prototype[key].apply(this, arguments); };
      }(arrayMethods[i]));
    }
  }
};

js.util.unique.used = {};

js.util.unique.reset = function(namespace){
  delete js.util.unique.used[namespace];
};
