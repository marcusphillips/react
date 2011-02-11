var js = js || {

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

  merge: function(target, source){
    for(var key in source){
      target[key] = source[key];
    }
    return target;
  },

  copy: function(seed){
    var copy = Object.prototype.toString.call(seed) === '[object Array]' ? [] : typeof seed === 'object' || typeof seed === 'function' ? {} : seed;
    return js.merge(copy, seed);
  }
};

js.util.unique.used = {};

js.util.unique.reset = function(namespace){
  delete js.util.unique.used[namespace];
};
