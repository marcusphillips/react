var js = js || {

  debugIf: function(condition){
    if(condition){debugger;}
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

  map: function(collection, block){
    js.errorIf(typeof collection.length === 'undefined', 'js.map is currently written for arrays only');
    var result = [];
    for(var which = 0; which < collection.length; which++){
      result.push(block(which, collection[which]));
    }
    return result;
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
      if(callback(array[i])){
        result.push(array[i]);
      }
    }
    return result;
  },

  defaulted: function(value, alternative){
    return typeof value === 'undefined' ? alternative : value;
  },

  error: function(message){
    throw new Error(message);
  },

  errorIf: function(condition, message){
    if(condition){
      this.error(message);
    }
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
    var copy = Object.prototype.toString.call(seed) === '[object Array]' ? [] : typeof seed === 'object' || typeof seed === 'function' ? {} : seed;
    return js.extend(copy, seed);
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
