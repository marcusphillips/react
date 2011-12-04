/*!
 * React for JavaScript - an easy-rerender template language
 * Version 1.3, http://github.com/marcusphillips/react
 *
 * Copyright 2010, Marcus Phillips
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function(undefined) {

  /*
   * Library-wide helpers
   */

  var debugging = false;
  var noop = function(){};

  var throwError = js.error, throwErrorIf = js.errorIf, log = js.log, catchIf = js.catchIf;
  var bind = js.bind, create = js.create, unique = js.unique, extend = js.extend, trim = js.trim, isArray = js.isArray;
  var map = js.map, reduce = js.reduce, each = js.each, filter = js.filter, exhaust = js.exhaust;
  var keysFor = js.keys, hasKeys = js.hasKeys, among = js.among, clear = js.clear, concatArrays = js.concatArrays;
  var Set = js.Set;

  var arraySlice = Array.prototype.slice;
  var slice = function(collection){ return arraySlice.call(collection, arraySlice.call(arguments, 1)); };

  var specialDirectives = {before: true, anchored: true, after: true};
  var matchers = {
    directiveDelimiter: /\s*,\s*/,
    space: /\s+/,
    negation: /!\s*/,
    isString: /(^'.*'$)|(^".*"$)/,
    isNumber: /^\d+$/
  };

  var toArray = js.toArray;
// asdf get rid of getScopeKey()
  var getScopeKey = function(object){
    var key = object.reactKey || (object.reactKey = unique('reactObject'));
    react.scopes[key] || (react.scopes[key] = object);
    return key;
  };
  // returns a unique, consistent key for every node
  var getNodeKey = function(node){
    node instanceof jQuery && (node = node[0]);
    return node._reactKey || (node._reactKey = unique('reactKey'));
  };

  // Fallthroughs provide a mechanism for binding one key in a scope to the value at another key
  var Fallthrough = function(key){ this.key = key; };


  /*
   * Library interface
   */

  var react = {

    nodes: {},
    scopes: {},

    debug: function(){ debugging = true; },

    // for giving scope objects meaningful names, which appear in the anchor directives on nodes. not yet ready for external consumption
    name: function(name, object){
      throwErrorIf(object.reactKey, 'You tried to name a scope object that already had a name');
      return this.scopes[name] = extend(object, {reactKey: name});
    },

    reset: function(){
      clear(this.scopes);
      clear(this.nodes);
    },

    // convenience method for setting object values and automatically calling changed on them
    set: function(object, key, value){
      object[key] = value;
      this.changed(object, key);
    },

    // allows user to notify react that an object's property has changed, so the relevant nodes may be updated
    changed: function(){
      var operation = new Operation();
      operation.changed.apply(operation, arguments).run();
    },

    update: function(input){
      var node = input;
      if(node instanceof jQuery){
        throwErrorIf(node.length !== 1, 'you cannot pass a jquery object containing many nodes to react.update()');
        node = node[0];
      }
      throwErrorIf(!node, 'you did not pass a valid node to react.update()');
      var operation = new Operation();
      operation.$(node).getDirective('before').updateBranch();
      operation.run();
      return input;
    },

    anchor: function(node){
      // todo: clean up any links elsewhere (like listeners) that are left by potential existing anchors
      var scopes = slice(arguments, 1);
      var anchoredTokens = ['anchored'].concat(map(scopes, getScopeKey));
      new Operation().$(this.nodes[getNodeKey(node)] = node).setDirective('anchored', anchoredTokens).$$node.update();
      return node;
    },

    helpers: extend(function(focus, deeply){
      extend(focus, react.helpers);

      if(deeply){
        var key;
        for(key in focus){
          if(key !== 'set' && focus[key] && typeof focus[key] === 'object' && !focus[key].set){
            react.helpers(focus[key], deeply);
          }
        }
      }

      return focus;
    },{

      anchor: function(node){
        jQuery(node).anchor(this);
        return this;
      },

      set: function(key, value){
        var newValues = {};
        typeof key === 'object' ? newValues = key : newValues[key] = value;
        react.changed(extend(this, newValues), keysFor(newValues));
      },

      del: function(keys){
        var i;
        keys = isArray(keys) ? keys : [keys];
        for(i = 0; i < keys.length; i+=1){
          delete this[keys[i]];
        }
        react.changed(this, keys);
      },

      changed: function(){ react.changed(this); }

    }),

    integrate: {
      jQuery: function(){
        var singularize = function(method){
          return function(){
            throwErrorIf(this.length !== 1, 'react\'s jQuery helpers can only be run on jQuery objects containing a single member');
            return method.apply(this, arguments);
          };
        };

        jQuery.fn.extend(map({

          update: function(){ return react.update(this); },

          anchor: function(){
            if(!arguments.length){
              var scopes = this.anchors();
              throwErrorIf(scopes.length !== 1, '.anchor() can only be called on nodes with a single anchored object');
              return scopes[0];
            }
            return react.anchor.apply(react, [this].concat(slice(arguments)));
          },

          anchors: function(){
            return map(new Operation().$(this[0]).getDirective('anchored').inputs, function(scopeName){
              return react.scopes[scopeName];
            });
          },

/*
          boundChildren: function(directiveString){
            return this.find(':not(.'+this.boundKey()+' [react] [react])[react]').filter(function(){
               return !isAnchored(somehow...); // this might also be doable in a not selector
            }).boundFilter(directiveString);

            manual implementation
            var $ceiling = jQuery(this);
            var $boundChildren = $ceiling.find('[react]').filter(function(which, item){
              var $ancestor = jQuery(item);
              while(($ancestor = $ancestor.parent()).length){
                if($ancestor[0] === $ceiling[0]){ return true; }
                else if($ancestor.is('[react]') || $ancestor.isAnchored()){ return false; }
              }
            });
            return $boundChildren.boundFilter(directiveString);
          },

          boundFilter: function(directiveString){
            var i;
            if(!directiveString){ return this; }
            var directive = new DirectiveVisit(directiveString);
            return this.filter(function(item){
              var directives = jQuery(item).boundDirectives();
              for(i = 0; i < directives.length; i+=1){
                if(directive.inputs ? directive.matches(each) : directive.command === each.command){ return true; }
              }
            });
          },
*/

          items: function(){ return this.children().slice(1); },
          item: function(which){ return this.items().eq(which); },
          itemTemplate: function(){ return this.children().eq(0); }

        }, singularize));
      }
    }

  };

  var commands = react.commands = {scopes: react.scopes};




  /*
   * Scope chains
   */

  // Scope chains are used to model namespace lookup behavior in templates
  // all scope chains should be built by calling emptyScopeChain.extend()

  var ScopeChain = function(type, previousLink, additionalScope, options){
    options = options || {};

    extend(this, {
      parent: previousLink,
      scope: additionalScope,
      type: type,
      key: options.key,
      prefix: options.prefix || '',
      // todo this shouldn't need a prefix
      anchorKey: options.anchorKey || (type === 'anchor' ? options.key : (previousLink||{}).anchorKey)
    });
  };

  extend(ScopeChain.prototype, {

    contains: function(scope){ return this.scope === scope || (this.parent && this.parent.contains(scope)); },
    extend: function(type, additionalScope, options){ return new ScopeChain(type, this, additionalScope, options); },
    extendWithMany: function(type, scopes, options){
      return reduce(scopes || [], this, function(memo, scope){
        return memo.extend(type, scope, options);
      });
    },

    lookup: function(){ return this.detailedLookup.apply(this, arguments).value; },

    // provides the value at a given key by looking through the scope chain from this leaf up
    detailedLookup: function(key, options){
      var negate;
      options = options || {};
      key = key.toString();
      if(key[0] === '!'){
        negate = true;
        key = key.slice(1);
      }
      // the details object will contain all interesting aspects of this lookup
      // potentialObservers will hold the scopeChain/key pairs that may need to be bound for future updates
      var details = {potentialObservers: []};
      // extend details must be called on any return values, since it handles the final step of negation
      var extendDetails = function(moreDetails){
        var key;
        for(key in moreDetails||{}){
          details[key] = (
            key === 'potentialObservers' ? details.potentialObservers.concat(moreDetails.potentialObservers || []) :
            key === 'didMatchFocus' ? details.didMatchFocus || moreDetails.didMatchFocus :
            moreDetails[key]
          );
        }
        if(negate){ details.value = !details.vailue; }
        return details;
      };

      // all lookups fail in the empty scope chain
      if(this === emptyScopeChain){
        return extendDetails({failed:true});
      }

      if (matchers.isString.test(key)) {
        throwErrorIf(negate, 'You can\'t negate literals using the exlamation point');
        return extendDetails({value: key.slice(1, key.length-1)});
      }

      var path = key.split('.');
      // base key is the first segment of a path that uses dot access. It's is the only segment that will be taken from the current scope chain
      var baseKey = path.shift();
      var value = this.scope[baseKey];

      // a Fallthrough object remaps the baseKey to a new baseKey in the previous scope
      if(value instanceof Fallthrough){
        return extendDetails(this.parent.detailedLookup( [value.key].concat(path).join('.'), options ));
      }

      details.potentialObservers.push({scopeChain: this, key: baseKey});
      details.didMatchFocus = details.didMatchFocus || (!path.length && options.checkFocus && options.checkFocus === this.scope);
      // recurse onto the parent scopeChain if the lookup fails at this level
      if(! (baseKey in this.scope) ){
        return extendDetails(this.parent.detailedLookup(key, options));
      }

      // for dot access
      if(path.length){
        if(value === undefined || value === null){
          // Could not find the key on a null or undefined object at path this.prefix+baseKey from this.scope
          return extendDetails();
        }
        return extendDetails(emptyScopeChain.extend('dotAccess', value, {
          // todo - i think this needs to pass a key
          prefix: this.prefix + baseKey + '.',
          anchorKey: this.anchorKey
        }).detailedLookup(path.join('.'), options));
      }

      // functions are called before being returned
      value = typeof value === 'function' ? value.call(this.scope) : value;

      return extendDetails({value: value});
    },

    // provides a description of the scope chain in array format, optimized for viewing in the console
    describe: function(){
      return [
        ['scope: ', this.scope, ', type of scope shift: ' + this.type + (this.key ? ' (key: '+this.key+')': '') + (this.anchorKey ? ', anchored to: '+this.anchorKey+')': '')]
      ].concat(this.parent ? this.parent.describe() : []);
    }

  });

  var emptyScopeChain = new ScopeChain('empty');




  /*
   * Operation
   */

  // An operation provides a shared context where complex interactions may rely upon shared state

  var Operation = function(){
    extend(this, {

      // within an operation, all $$node objects are cached to maintain object-identicality across calls to $()
      _metaNodes: {},

      // directives we plan to visit, by key
      // to ensure root-first processing order, we earmark each directive we plan to follow, then follow them all during the run() step
      _toVisit: makeDirectiveSet(),

      _hasRun: false,
      _isRunning: false

    });
  };

  extend(Operation.prototype, {

    $: function(node){ return this._metaNodes[getNodeKey(node)] || (this._metaNodes[getNodeKey(node)] = new $$(node).makeMeta(this)); },

    hasRun: function(){ return this._hasRun; },
    isRunning: function(){ return this._isRunning; },

    visit: function(directive){ return this._toVisit.add(directive); },

    run: function(){
      throwErrorIf(this._hasRun || this._isRunning, 'An operation cannot be run twice');
      extend(this, {_isRunning: true});

      // iterating over the toVisit list once isn't sufficient, we have to exhaust the hash of keys. Since considering a directive might have the effect of extending the hash further, and order of elements in a hash is not guarenteed
      this._toVisit.exhaust(function(directive){
        directive.visit();
      });

      extend(this, {_isRunning: false, _hasRun: true});
    },

//asdf get rid of this crazy caching
    getProxy: function(object){ return this['proxy:'+object.reactKey] || (this['proxy:'+object.reactKey] = new Proxy(object)); },

    changed: function(object, keys){
      each(this.getProxy(object).observersForKeys(keys), function(observer){
//asdf replace with this.getMetaObserver(observer).dirty();
        this.$(observer.directive.$$node).getDirective(observer.directive.key).dirtyObserver(observer);
      }, this);
      return this;
    }

  });




  /*
   * $$ (subclass of jQuery)
   */

  // Overriding jQuery to provide supplemental functionality to DOM node wrappers
  // Within the scope of the Operation constructor, all calls to $$() return a customized jQuery object. For access to the original, use jQuery()
  var $$ = function(node){
    node && 'length' in node && (node = node[0]);
    throwErrorIf(!node || node.nodeType !== 1, 'node arg must be a DOM node');

    extend(jQuery.prototype.init.call(this, node), {
      node: node,
      key: getNodeKey(node)
    }).directives = new DirectiveList(this);

    this.getStorage('initialized') || this.initializeNode();
  };

  $$.prototype = create(jQuery.prototype, {
    // note: a correct mapping of the .constructor property to $$ breaks jquery, since it calls new this.constructor() with no arguments

    makeMeta: function(operation){ return new MetaNode(this, operation); },
    makeDirective: function(key, tokens){ return new Directive(this, key, tokens); },
    getDirective: function(key){ return this.directives.getByKey(key); },

    isInitialized: function(){ return !!this.getStorage('initialized'); },
    initializeNode: function(){
      this.setStorage('initialized', true);
      this.directives.write();
    },

    // todo: setting "indexKeyPairs: true" results in copies of the node getting their directive indices mapped to the same values, even before being initialized
    _storeInAttr: {},
    getStorage: function(key){
      this.node._boundStorage || (this.node._boundStorage = {});
      return this._storeInAttr[key] ? this.attr('data-bound-storage-'+key) : this.node._boundStorage[key];
    },
    setStorage: function(key, value){
      var mappings = {};
      key && typeof key === 'object' ? mappings = key : mappings[key] = value;

      this.node._boundStorage || (this.node._boundStorage = {});
      for(key in mappings){
        this._storeInAttr[key] ? this.attr('data-bound-storage-'+key, mappings[key]) : this.node._boundStorage[key] = mappings[key];
      }
      return this;
    },

    store: function(){ react.nodes[this.key] = this.node; },

    setDirectivesString: function(value){
      // if the value is being set to empty, and the node already has an inert directives string (empty string or no attribute at all), then don't alter its state
      // modifying all nodes that lacked attributes to have react="" would result in over-matching of the nodes on subsequent DOM queries
      return (value || this.attr('react')) ? this.attr('react', value) : this;
    },
    getDirectivesString: function(){ return this.attr('react') || ''; },
    getDirectiveStrings: function(){
      return map(this.getDirectivesString().split(matchers.directiveDelimiter), function(string){
        return trim(string).replace(matchers.negation, '!').replace(matchers.space, ' ');
      });
    },
    getDirectiveArrays: function(){
      return reduce(this.getDirectiveStrings(), [], function(memo, string){
        return string ? memo.concat([trim(string).split(matchers.space)]) : memo;
      });
    },

  });


  /*
   * MetaNode (metadata for operations, about nodes)
   */

  var MetaNode = function($$node, operation){
    extend(this, MetaNode.prototype, {
      $$node: $$node,
      metaDirectives: {},
      _operation: operation,
      _isSearched: undefined
    });
  };

  extend(MetaNode.prototype, {

    getDirective: function(key){ return this.metaDirectives[key] || (this.metaDirectives[key] = this.$$node.getDirective(key).makeMeta(this)); },

    setDirective: function(key, tokens){
      this.$$node.directives.set(key, tokens);
      return this;
    },

    wrappedParent: function(){
      var parent = this.$$node.parent()[0];
      return (
        ! parent ? null :
        parent === document ? null :
        this._operation.$(parent)
      );
    },

    getReactNodes: function(){ return [this].concat(this.getReactDescendants()); },

    // note: getReactDescendants() only returns descendant nodes that have a 'react' attribute on them. any other nodes of interest to react (such as item templates that lack a 'react' attr) will not be included
    // todo: optimize selection criteria
    // return map(toArray(this.find('[react]:not([:data-anchored-to]):not([:data-anchored-to] *)')), function(node){
    getReactDescendants: function(){
      return map((this.$$node.find('[react]')), bind(this._operation.$, this._operation));
    },

    search: function(){
      // when considering updating the after directive of all descendant react nodes, we need to include the root as well, since we might be calling this on another earlier directive of that node
      this._isSearched || each(this.getReactNodes(), function(metaNode){
        // since the querySelectorAll operation finds ALL relevant descendants, we will not need to run it again on any of the children returned by the operation
        extend(metaNode, {_isSearched: true}).getDirective('after').consider();
      });
    },

    getDirectiveByIndex: function(index){
      return this.getDirective(this.$$node.directives.getKey(index));
    }

  });




  /*
   * Directive
   */

  // provides an object representing the directive itself (for example, "contain user.name")

  var Directive = function($$node, key, tokens){
    extend(this, {
      $$node: $$node,
      node: $$node[0],
      command: tokens[0],
      inputs: tokens.slice(1),
      key: key
    });
  };

  extend(Directive.prototype, {
    toString: function(){ return [this.command].concat(this.inputs).join(' '); },
    uniqueKey: function(){ return this.$$node.key+' '+this.key; },
    makeMeta: function(metaNode){ return new MetaDirective(this, metaNode); }
  });




  /*
   * MetaDirective
   */

  // provides an object representing an operation's perspective on the directive for the duration of that operation's execution

  var MetaDirective = function(directive, metaNode){
    return extend(create(directive), MetaDirective.prototype, {
      directive: directive,
      metaNode: metaNode,
      $$node: metaNode.$$node,
      _operation: metaNode._operation,
      _scopeChain: undefined,
      _isVisited: undefined,
      _isDead: undefined,
      _shouldUpdate: undefined,
      _shouldUpdateBranch: undefined,
      _parentInfo: undefined,
      _dirtyObservers: {},
      _potentialObservers: []
    });
  };

  MetaDirective.prototype = extend(create(commands), {
    constructor: MetaDirective,

    $: function(node){ return this._operation.$(node); },
    search: function(){ this.metaNode.search(); },

    resetScopeChain: function(){ this._scopeChain = emptyScopeChain; },
    pushScope: function(type, scope, options){ this._scopeChain = this.getScopeChain().extend(type, scope, options); },
    getScope: function(){ return this.getScopeChain().scope; },
    getScopeChain: function(){ return this._scopeChain || (this._scopeChain = this.parentInfo().scopeChain); },

    // calling this method ensures that the directive (and all its parents) will be considered for updating in the operation, and considered for a rendering update
    consider: function(){ return this._operation.visit(this); },
    update: function(){ return extend(this, {_shouldUpdate: true}).consider(); },
    updateBranch: function(){ return extend(this, {_shouldUpdateBranch: true}).update(); },

    isVisited: function(){ return this._isVisited; },
    isDead: function(){ return this._isDead || this.parentInfo().isDead; },
    shouldUpdateBranch: function(){
      return this.shouldUpdate() && (this._shouldUpdateBranch || this.parentInfo().shouldUpdateBranch);
    },
    shouldUpdate: function(){
      if(this.isDead()){ return false; }
      return this._shouldUpdate || (this._shouldUpdate = this.parentInfo().shouldUpdateBranch || this.dirtyObserverPertains());
    },

    lookup: function(key){
      var details = this.getScopeChain().detailedLookup(key);
      this._potentialObservers = this._potentialObservers.concat(details.potentialObservers);
      return details.value;
    },

    dirtyObserver: function(observer){
      this._dirtyObservers[observer.key] = observer;
      return this.consider();
    },

    dirtyObserverPertains: function(){
      var scopeChain = this.getScopeChain();
      return reduce(this._dirtyObservers, false, function(memo, observer){
        // ignore the object if it's not in the same path that lead to registration of the observer
        return memo || scopeChain.detailedLookup(observer.prefix + observer.propertyKey, {checkFocus: observer.object}).didMatchFocus;
      }, this);
    },

    onUpdate: function(callback){
      this.shouldUpdate() && callback && callback.call(this);
      return this;
    },

    // the directive's command (for example, 'contain') will be executed with a 'this' context of that directive
    visit: function(){
      if(this.isVisited()){ return this; }
      this._isVisited = true;
      this.parentInfo().parent.visit();
      var willUpdate = this.shouldUpdate();

      catchIf(debugging, function(){
        this._runCommand(this.command, this.inputs);
      }, function(error){
        throw this._describeError(error);
      }, this);

      if(willUpdate){
        this._registerPotentialObservers();
        this.shouldUpdateBranch() && this.search();
      }
      return this;
    },

    _runCommand: function(command, inputs){
      throwErrorIf(!this._operation.isRunning(), 'tried to .visit() a directive outside of operation.run()');
      throwErrorIf(!commands[command], 'not a valid react command: '+command);
      var resolverKey = "resolve_"+command;
      var resolver = commands[resolverKey] || (commands[resolverKey] = commands[resolverKey] === false ? this._nonResolver : this._fullResolver);
      commands[command].apply(this, resolver.call(this, inputs));
    },
    _nonResolver: function(names){ return names; },
    _fullResolver: function(names){ return map(names, bind(this.lookup, this)); },

    _registerPotentialObservers: function(){
      each(this._potentialObservers, function(potentialObserver/*, key? might be stored in an object (asdf)*/){
        if(potentialObserver.scopeChain.anchorKey){
          new Proxy(potentialObserver.scopeChain.scope).observe(potentialObserver.key, this.directive, potentialObserver.scopeChain.prefix);
        }
      }, this);
    },

    parentInfo: function(){
      if(this._parentInfo){ return this._parentInfo; }
      var repeatLimit = 10000, parent;
      while(parent !== ( parent = this.currentParent() )){
        parent.visit();
        throwErrorIf(!(repeatLimit--), 'Too much parent reassignment'); //You've done something in your directive that makes the parent directive change every time the current parent runs. This is most likely caused by lookups to function properties that mutate the DOM structure
      }
      return (this._parentInfo = {
        parent: parent,
        isDead: parent.isDead(),
        shouldUpdateBranch: parent.shouldUpdateBranch(),
        scopeChain: parent.getScopeChain()
      });
    },

    currentParent: function(){
      var index = this.$$node.directives.getIndex(this.key).toString();
      return (
        index === 'before' ? (
          this.metaNode.getDirective('anchored').inputs.length ? nullDirective :
          !this.metaNode.wrappedParent() ? nullDirective :
          this.metaNode.wrappedParent().getDirective('after')
        ) :
        index === 'anchored' ? this.metaNode.getDirective('before') :
        index === '0' ? this.metaNode.getDirective('anchored') :
        index.match(matchers.isNumber) ? this.metaNode.getDirectiveByIndex(index-1) :
        index === 'after' ? (this.$$node.directives.length ? this.metaNode.getDirectiveByIndex(this.$$node.directives.length-1) : this.metaNode.getDirective('anchored')) :
        throwError('invalid directive key')
      );
    },

    _describeError: function(error){
      log('Failure during React update: ', {
        'original error': error,
        'original stack': error.stack && error.stack.split ? error.stack.split('\n') : error.stack,
        'while processing node': this.node,
        'key of failed directive': this.key,
        'directive call': this.command+'('+this.inputs && this.inputs.join(', ')+')'
      }, '(Supplemental dynamic data follows)');
      log('Supplemental: ', {
        'index of failed directive': this.$$node.directives.getIndex(this.key),
        'scope chain description': this.getScopeChain().describe(),
        '(internal scope chain object) ': this.getScopeChain()
      });
      return error;
    }

  });

  var nullDirective = {
    visit: noop,
    isDead: noop,
    shouldUpdate: noop,
    shouldUpdateBranch: noop,
    getScopeChain: function(){ return emptyScopeChain; },
    parentInfo: function(){ throwError('internal error: cannot get the parent of a null directive'); }
  };




  /*
   * DirectiveSet
   */

  var makeDirectiveSet = function(){ return new Set(getDirectiveKey); };
  var getDirectiveKey = function(item){ return item.uniqueKey(); };




  /*
   * Two-way mapping
   */

  var TwoWayMap = function(serialized){
    extend(this, { _ltr: {}, _rtl: {} });
    serialized && this.fromString(serialized);
  };

  extend(TwoWayMap.prototype, {
    map: function(left, right){
      throwErrorIf(this._ltr[left], 'mapping already exists for left ', left);
      throwErrorIf(this._rtl[right], 'mapping already exists for right ', right);
      this._ltr[left] = right;
      this._rtl[right] = left;
    },

    getLeft: function(right){ return this._rtl[right]; },
    getRight: function(left){ return this._ltr[left]; },

    releaseLeft: function(left){
      delete this._rtl[this._ltr[left]];
      delete this._ltr[left];
    },

    releaseRight: function(right){
      delete this._ltr[this._rtl[right]];
      delete this._rtl[right];
    },

    // note: these serialization and de-serialization functions are built to work only with the case where all left-side values are sequential indices
    toString: function(){
      return reduce(this._ltr, [], function(memo, right, left){
        memo[left] = right;
        return memo;
      }).join(',');
    },

    fromString: function(string){
      each(filter(string.split(',')), function(right, left){
        this.map(left, right);
      }, this);
    }

  });




  /*
   * Directive List
   */

  var DirectiveList = function($$node){
    extend(this, {
      $$node: $$node,
      _indexKeyPairs: new TwoWayMap($$node.getStorage('indexKeyPairs')),
      _validatedDirectivesString: $$node.getStorage('validatedDirectivesString') || $$node.getDirectivesString()
    }).buildDirectives();
    throwErrorIf(this._validatedDirectivesString !== $$node.getDirectivesString(), 'directives string changed manually since last visit');
  };

  extend(DirectiveList.prototype, {

    toString: function(){ return this.orderedForString().join(', '); },
    orderedForString: function(){ return (this.anchored.inputs.length ? [this.anchored] : []).concat(toArray(this)); },

    getStorage: function(){ return this.$$node.getStorage.apply(this.$$node, arguments); },
    setStorage: function(){ return this.$$node.setStorage.apply(this.$$node, arguments); },

    getKey: function(index){ return specialDirectives[index] ? index : this._indexKeyPairs.getRight(index); },
    getIndex: function(key){ return specialDirectives[key] ? key : this._indexKeyPairs.getLeft(key); },
    releaseIndex: function(index){ return this._indexKeyPairs.releaseLeft(index); },
    releaseKey: function(key){ return this._indexKeyPairs.releaseRight(key); },

    getByKey: function(key){ return this[this.getIndex(key)]; },
    makeKey: function(index){
      var key = (this.getStorage('lastDirectiveKey') || 0) + 1;
      this.mapIndexToKey(index, key).setStorage('lastDirectiveKey', key);
      return key;
    },
    mapIndexToKey: function(index, key){
      throwErrorIf(specialDirectives[index], 'cannot explicitly set keys for special directives');
      this._indexKeyPairs.map(index, key);
      return this;
    },

    buildDirectives: function(){
      var i;
      var $$node = this.$$node;
      var isInitialized = $$node.isInitialized();
      var tokenArrays = $$node.getDirectiveArrays();
      var anchoredTokens = tokenArrays[0] && tokenArrays[0][0] === 'anchored' ? tokenArrays.shift() : ['anchored'];

      extend(this, {
        length: tokenArrays.length,
        before: $$node.makeDirective('before', ['before']),
        anchored: $$node.makeDirective('anchored', anchoredTokens),
        after: $$node.makeDirective('after', ['after'])
      });

//asdf move to a linked list, and store all directives by their key, not index
      for(i = 0; i < tokenArrays.length; i++){
        this[i] = $$node.makeDirective(isInitialized ? this.getKey(i) : this.makeKey(i), tokenArrays[i]);
      }
    },

    set: function(index, tokens){
      var key = specialDirectives[index] ? this.getKey(index) : (this.releaseKey(index), this.makeKey(index));
      this[index] = this.$$node.makeDirective(key, tokens);
      return this.write();
    },

    push: function(tokens){
      this[this.length] = this.$$node.makeDirective(this.makeKey(this.length), tokens);
      this.length += 1;
      return this.write();
    },

    unshift: function(tokens){
      for(var i = this.length-1; 0 <= i; i--){
        this[i+1] = this[i];
        this.releaseIndex(i);
        this.mapIndexToKey(i+1, this[i+1].key);
      }
      this[0] = this.$$node.makeDirective(this.makeKey('0'), tokens);
      this.length += 1;

      return this.write();
    },

    write: function(){
      var newDirectivesString = this.toString();
      var currentDirectivesString = this.$$node.getDirectivesString();
      throwErrorIf(currentDirectivesString !== this._validatedDirectivesString, 'conflicting change to directives attribute');

      this.$$node.setDirectivesString(this._validatedDirectivesString = newDirectivesString).setStorage({
        validatedDirectivesString: newDirectivesString,
        indexKeyPairs: this._indexKeyPairs.toString()
      });
      return this;
    }

  });




  /*
   * Proxy
   */

  // A proxy provides an interface for the observer relationship between any JS object and the nodes/directives observing it's properties
  var Proxy = function(object){
    this._object = object;
  };

  extend(Proxy.prototype, {
    // writes an association between a directive and a property on an object by annotating the object
//asdf re-order args
//asdf make observe() a method of directive instead
    observe: function(key, directive, prefix){
      directive.$$node.store();
      new Observer(directive, this._object, key, prefix).write();
    },

    // if there are no observers for the supplied key, do nothing
    observersForKey: function(propertyKey){ return map( keysFor(this._object.observers[propertyKey]) || [], Observer.fromKey ); },
    observersForKeys: function(keys){
      // if no key is supplied, check every key
      keys = (
        isArray(keys) ? keys :
        keys !== undefined ? [keys] :
        keysFor(this._object).concat('length' in this._object && !this._object.propertyIsEnumerable('length') ? ['length'] : [])
      );

      // we first need to collect all the observers of the changed keys
      return concatArrays( map(this._object.observers ? keys : [], this.observersForKey, this) );
    }

  });



  /*
   * Observer
   */

  var Observer = function(directive, object, propertyKey, prefix){
    return extend(this, {
      object: object,
      propertyKey: propertyKey,
      prefix: prefix,
      directive: directive
    }).key = this._makeKey();
  };

  Observer.fromKey = function(key){
    var tokens = key.split(matchers.space);
    return new Observer(new $$(react.nodes[tokens[0]]).getDirective(tokens[1]), react.scopes[tokens[2]], tokens[3], tokens[4]);
  };

  extend(Observer.prototype, {
    _makeKey: function(){ return [this.directive.uniqueKey(), getScopeKey(this.object), this.propertyKey, this.prefix].join(' '); },
    write: function(){
      var observers = this.object.observers = this.object.observers || {};
      var propertyObservers = observers[this.propertyKey] = observers[this.propertyKey] || {};
      propertyObservers[this.key] = true;
    }
  });




  /*
   * commands
   */

  extend(react.commands, {

    log: function(){
      typeof console !== 'undefined' && console.log('React render state:', {directive:this, scope:this.getScope(), inputs:arguments});
    },

    resolve_debug: false,
    debug: function(commandKey){
      debugger;
      this._runCommand(commandKey, slice(arguments, 1));
    },

    resolve_debugIf: false,
    debugIf: function(conditionKey, commandKey){
      if(this.lookup(conditionKey)){ debugger; }
      this._runCommand(commandKey, slice(arguments, 2));
    },

    before: function(){
      if(this.$$node.hasClass('reactItemTemplate')){
        this.dead();
      }
    },

    after: noop,

    dead: function(){
      return this._isDead = true;
    },

    resolve_anchored: false,
    anchored: function(/*token1, ...tokenN */){
      //this.resetScopeChain();
      var i;
      for(i = 0; i < arguments.length; i+=1){
        var token = arguments[i];
        if(this.scopes[token]){
          this.pushScope('anchor', this.scopes[token], {key:token});
        }else{
          // anchored directive failed to find a scope for the key
          this.dead();
        }
      }
      this.onUpdate(function(){
        this.updateBranch();
      });
    },


    resolve_within: false,
    within: function(key){
      this._withScope('within', key);
    },

    _withScope: function(type, key){
      var scope = this.lookup(key);
      this.onUpdate(function(){
        this.updateBranch();
      });
      if(scope){
        this.$$node.removeClass('reactConditionallyHidden');
        this.pushScope(type, scope, {key:key});
      }else{
        this.$$node.addClass('reactConditionallyHidden');
        this.dead();
      }
    },

    resolve_withinItem: false,
    withinItem: function(key){
      // todo: add a rule to only allow getting items from last scope (check if key < scope.length?)
      // todo: add a rule to make sure the last scope object is an array
      if(isArray(this.getScope()) && +key < this.getScope().length && this.getScope()[key]){
        this._withScope('withinItem', key);
      }else{
        this.dead();
      }
    },

    withinEach: function(){
      this._createItemNodes(function(index, itemNode){
        this.$(itemNode).$$node.directives.unshift(['withinItem', index]);
      });
      this.onUpdate(function(){
        this.updateBranch();
      });
    },

    resolve_bindItem: false,
    bindItem: function(key, keyAlias, valueAlias){
      if(valueAlias === undefined){
        valueAlias = keyAlias;
        keyAlias = undefined;
      }

      // set up an item scope to be applied for each item
      // a new scope will be created with bindings for valueAlias and optionally for keyAlias
      var itemBindings = {};
      if(keyAlias !== undefined){
        itemBindings[keyAlias] = key;
      }
      itemBindings[valueAlias] = new Fallthrough(key);

      this.pushScope('bindItem', itemBindings, {key:key});

      this.onUpdate(function(){
        this.updateBranch();
      });
    },


    resolve_for: false,
    'for': function(keyAlias, valueAlias){
      var aliases = slice(arguments);
      this.onUpdate(function(){
        // todo: return here (and everywhere else) if collection is undefined.  test for this
        this._createItemNodes(function(index, itemNode){
          this.$(itemNode).$$node.directives.unshift( ['bindItem', index].concat(aliases) );
        });
        this.updateBranch();
      });
    },

    _createItemNodes: function(callback){
      var $children = this.$$node.children();
      var $itemTemplate = $children.first().addClass('reactItemTemplate');
      if(!$itemTemplate.length){ return; }

      var collection = this.getScope();
      if(!isArray(collection)){ return this.dead(); }
      // this ensures that the directive will depend upon any changes to the length of the array
      this.lookup('length');

      var itemNodes = [], pregeneratedItemCount = 0, lastPregeneratedItem = $itemTemplate, itemsToRemove = [], i;
      for(i = 1; i < $children.length; i+=1){
        if(this.$($children[i]).$$node.hasClass('reactItem')){
          pregeneratedItemCount+=1;
          collection.length < pregeneratedItemCount ? itemsToRemove.push($children[i]) : (lastPregeneratedItem = $children[i]);
        }
      }
      var newItems = [], newItem;
      for(i = pregeneratedItemCount; i < collection.length; i+=1){
        callback.call(this, i, newItem = $itemTemplate.clone().removeClass('reactItemTemplate').addClass('reactItem')[0]);
        this.$(newItem).getDirective('before').updateBranch();
        newItems.push(newItem);
      }
      $(itemsToRemove).detach();
      $(newItems).insertAfter(lastPregeneratedItem);
    },

    contain: function(content){
      this.onUpdate(function(){
        // using innerHTML to clear the node because the jQuery convenience functions unbind event handlers. This would be an unexpected side effect for most React user consumption cases.
        this.node.innerHTML = '';
        // if the content is a node, use the dom appending method, but insert other items as text
        var insertionMethod = content && content.nodeType ? 'append' : 'text';
        jQuery(this.node)[insertionMethod](content);
        // note: .dead() can't happen outside onUpdate() because disabling mutation should only happen when the branch is inserted, not when building an initial scope chain
        this.metaNode.getDirective('after').dead();
      });
      this.metaNode.getDirective('after').resetScopeChain();
    },

    'if': function(condition){
      if(!condition){ this.dead(); }
      this.onUpdate(function(){
        $(this.node)[condition ? 'removeClass' : 'addClass']('reactConditionallyHidden');
        this._conditionalShow(condition);
        this.updateBranch();
      });
    },

    _conditionalShow: function(conditional){
      jQuery(this.node)[conditional ? 'show' : 'hide']();
    },

    showIf: function(condition){
      this.onUpdate(function(){
        this._conditionalShow(condition);
      });
    },

    visIf: function(condition){
      this.onUpdate(function(){
        jQuery(this.node).css('visibility', condition ? 'visible' : 'hidden');
      });
    },

    resolve_classIf: false,
    classIf: function(conditionKey, nameKey){
      this.onUpdate(function(){
        this.node.classIfs = this.node.classIfs || {};
        var condition = this.lookup(conditionKey);
        var persistence = conditionKey + ' ' + nameKey;
        var className = this.lookup(nameKey);

        if(this.node.classIfs[persistence] && (!condition || this.node.classIfs[persistence] !== className)){
          $(this.node).removeClass(this.node.classIfs[persistence]);
          delete this.node.classIfs[persistence];
        }

        if(typeof className === 'string'){
          if(condition){
            $(this.node).addClass(className);
            this.node.classIfs[persistence] = className;
          } else {
            $(this.node).removeClass(className);
          }
        }
      });
    },

    attr: function(name, value){
      throwErrorIf(arguments.length !== 2, 'the attr directive requires 2 arguments');
      this.onUpdate(function(){
        if(!among(typeof value, ['string', 'number', 'undefined'])){
          log('bad attr name: ', name);
          throwError('expected attr name token ' + name + ' to resolve to a string, a number, null, or undefined, not ' + typeof name);
        }else if(!among(typeof value, ['string', 'number', 'undefined'])){
          log('bad attr value: ', value);
          throwError('expected attr value token ' + value + ' to resolve to a string, a number, null, or undefined, not ' + typeof value);
        }
        jQuery(this.node).attr(name, value);
      });
    },

    attrIf: function(condition, name, value){
      this.onUpdate(function(){
        condition ? $(this.node).attr(name, value) : $(this.node).removeAttr(name);
      });
    },

    checkedIf: function(condition){
      this.onUpdate(function(){
        $(this.node).attr('checked', !!condition);
      });
    }

  });




  /*
   * Exporting library
   */

  window.jQuery && react.integrate.jQuery();
  window.react = react;

}());
