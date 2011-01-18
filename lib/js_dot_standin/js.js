var js = js || {
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
