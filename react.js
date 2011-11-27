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

  var noop = function(){};

  var throwError = js.error, throwErrorIf = js.errorIf, log = js.log;
  var create = js.create, unique = js.unique, extend = js.extend, trim = js.trim;
  var map = js.map, reduce = js.reduce, each = js.each, filter = js.filter;
  var keysFor = js.keys, hasKeys = js.hasKeys, isArray = js.isArray, among = js.among;


  var debugging = false;

  var matchers = {
    directiveDelimiter: /\s*,\s*/,
    space: /\s+/,
    negation: /!\s*/,
    isString: /(^'.*'$)|(^".*"$)/,
    isNumber: /^\d+$/,
    specialDirective: /^(before)|(anchored)|(after)$/
  };

  // returns a unique, consistent key for every node
  var getNodeKey = function(node){
    !(node instanceof jQuery) || (node = node[0]);
    return node._reactKey || (node._reactKey = unique('reactKey'));
  };

  var getScopeKey = function(object){
    return (object.reactKey = object.reactKey || unique('reactObject'));
  };

  var cacheAndGetScopeKey = function(scope){
    return getScopeKey(react.scopes[getScopeKey(scope)] = scope);
  };

  var makeArrayFromArrayLikeObject = function(arrayLikeObject){
    var array = [], i, length;
    for(i = 0, length = arrayLikeObject.length; i < length ; i+=1){
      array.push(arrayLikeObject[i]);
    }
    return array;
  };


  // Fallthroughs provide a mechanism for binding one key in a scope to the value at another key
  var Fallthrough = function(key){ this.key = key; };


  /*
   * Library interface
   */

  var react = {

    nodes: {},
    scopes: {},

    debug: function(){
      debugging = true;
    },

    // for giving scope objects meaningful names, which appear in the anchor directives on nodes. not yet ready for external consumption
    name: function(name, object){
      throwErrorIf(object.reactKey, 'You tried to name a scope object that already had a name');
      object.reactKey = name;
      return this.scopes[name] = object;
    },

    reset: function(){
      var key;
      for(key in this.scopes){
        delete this.scopes[key];
      }
      for(key in this.nodes){
        delete this.nodes[key];
      }
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
      operation.$(node).directives.before.updateBranch();
      operation.run();
      return input;
    },

    anchor: function(node){
      // todo: clean up any links elsewhere (like listeners) that are left by potential existing anchors
      var scopes = Array.prototype.slice.call(arguments, 1);
      var anchoredTokens = ['anchored'].concat(map(scopes, cacheAndGetScopeKey));
      new Operation().$(this.nodes[getNodeKey(node)] = node).setDirective('anchored', anchoredTokens).update();
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

      changed: function(){
        react.changed(this);
      }

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
            return react.anchor.apply(react, [this].concat(Array.prototype.slice.call(arguments)));
          },

          anchors: function(){
            return map(new Operation().$(this[0]).directives.anchored.inputs, function(scopeName){
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
            var directive = new Directive(directiveString);
            return this.filter(function(item){
              var directives = jQuery(item).boundDirectives();
              for(i = 0; i < directives.length; i+=1){
                if(directive.inputs ? directive.matches(each) : directive.command === each.command){ return true; }
              }
            });
          },
*/

          items: function(){
            return this.children().slice(1);
          },

          item: function(which){
            return this.items().eq(which);
          },

          itemTemplate: function(){
            return this.children().eq(0);
          }

        }, singularize));
      }
    }

  };

  var commands = react.commands = {
    scopes: react.scopes
  };




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

    contains: function(scope){
      return this.scope === scope || (this.parent && this.parent.contains(scope));
    },

    extend: function(type, additionalScope, options){
      return new ScopeChain(type, this, additionalScope, options);
    },

    extendWithMany: function(type, scopes, options){
      scopes = scopes || [];
      var lastLink = this;
      var which;
      for(which = 0; which < scopes.length; which+=1){
        lastLink = lastLink.extend(type, scopes[which], options);
      }
      return lastLink;
    },

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

    lookup: function(){
      return this.detailedLookup.apply(this, arguments).value;
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

      // within an operation, all $node objects are cached to maintain object-identicality across calls to $()
      _$nodes: {},

      // directives we plan to visit, by key
      // to ensure root-first processing order, we earmark each directive we plan to follow, then follow them all during the run() step
      _toVisit: {},

      // visited directives, by key
      _visited: {},

      // branches from which we have already collected all bound descendants
      _searched: {},

      _hasRun: false,
      _isRunning: false

    });
  };

  extend(Operation.prototype, {

    $: function(node){
      return this._$nodes[getNodeKey(node)] || (this._$nodes[getNodeKey(node)] = new NodeWrapper(this, node));
    },

    hasRun: function(){ return this._hasRun; },

    isRunning: function(){ return this._isRunning; },

    visit: function(directive){ this._toVisit[directive.uniqueKey()] = directive; },

    isSearched: function($node, setting){
      return setting === undefined ? this._searched[$node.key] : this._searched[$node.key] = setting;
    },

    run: function(){
      var limit = 10000,
          key;
      throwErrorIf(this._hasRun, 'An operation cannot be run twice');
      this._isRunning = true;
      // iterating over the toVisit list once isn't sufficient. Since considering a directive might extend the list, and order of elements in a hash is not guarenteed
      while(hasKeys(this._toVisit)){
        throwErrorIf(!(--limit), 'too many node additions');
        for(key in this._toVisit){
          throwErrorIf(this._visited[key], 'tried to consider the same directive twice');
          this._visited[key] = this._toVisit[key].visit();
          delete this._toVisit[key];
        }
      }
      this._isRunning = false;
      this._hasRun = true;
    },

    changed: function(object, keys){
      new Proxy(this, object).changed(keys);
      return this;
    }
  });




  /*
   * NodeWrapper (subclass of jQuery)
   */

  // Overriding jQuery to provide supplemental functionality to DOM node wrappers
  // Within the scope of the Operation constructor, all calls to NodeWrapper() return a customized jQuery object. For access to the original, use jQuery()
  var NodeWrapper = function(operation, node){
    if(node instanceof jQuery){ node = node[0]; }
    throwErrorIf(!node || node.nodeType !== 1 || isArray(node) || node instanceof jQuery, 'node arg must be a DOM node');

    jQuery.prototype.init.call(this, node);

    extend(this, {
      node: node,
      key: getNodeKey(node),
      _operation: operation
    });

    this.directives = new DirectiveSet(this);
    this.getMeta('initialized') ||  this.initializeNode();
  };

  NodeWrapper.prototype = create(jQuery.prototype, {

    // note: a correct mapping of the .constructor property to NodeWrapper breaks jquery, since it calls new this.constructor() with no arguments

    initializeNode: function(){ this.setMeta('initialized', true).directives.write(); },
    isInitialized: function(){ return !!this.getMeta('initialized'); },

    makeDirective: function(key, tokens){ return new Directive(this, key, tokens); },

    setDirective: function(key, tokens){
      this.directives.set(key, tokens);
      return this;
    },

    getDirectivesString: function(){ return this.attr('react') || ''; },
    setDirectivesString: function(value){
      // if the value is being set to empty, and the node already has an inert directives string (empty string or no attribute at all), then don't alter its state
      // modifying all nodes that lacked attributes to have react="" would result in over-matching of the nodes on subsequent DOM queries
      return (value || this.attr('react')) ? this.attr('react', value) : this;
    },

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

    wrappedParent: function(){
      return (
        ! this.parent()[0] ? null :
        this.parent()[0] === document ? null :
        this._operation.$(this.parent()[0])
      );
    },

    store: function(){
      react.nodes[this.key] = this.node;
    },

    setMeta: function(key, value){
      var mappings = {};
      key && typeof key === 'object' ? mappings = key : mappings[key] = value;

      this.node._boundMeta || (this.node._boundMeta = {});

      for(key in mappings){
        this._storeInAttr[key] ? this.attr('data-bound-meta-'+key, mappings[key]) : this.node._boundMeta[key] = mappings[key];
      }

      return this;
    },

    getMeta: function(key){
      this.node._boundMeta || (this.node._boundMeta = {});
      return this._storeInAttr[key] ? this.attr('data-bound-meta-'+key) : this.node._boundMeta[key];
    },

    _storeInAttr: {
      //indexKeyPairs: true // todo: this results in copies of the node getting their directive indices mapped to the same values, even before being initialized
    },

    // note: getReactDescendants() only returns descendant nodes that have a 'react' attribute on them. any other nodes of interest to react (such as item templates that lack a 'react' attr) will not be included
    getReactDescendants: function(){
      var that = this;

      // todo: optimize selection criteria
      // return map(makeArrayFromArrayLikeObject(this.find('[react]:not([:data-anchored-to]):not([:data-anchored-to] *)')), function(node){

      return map(makeArrayFromArrayLikeObject(this.find('[react]')), function(node){
        return that._operation.$(node);
      });
    },

    getReactNodes: function(){
      return [this].concat(this.getReactDescendants());
    }

  });




  /*
   * Directive
   */

  // provides an object representing the directive itself (for example, "contain user.name")
  var Directive = function($node, key, tokens){
    throwErrorIf(tokens instanceof Directive, 'input to constructor was already a directive!');

    extend(this, {
      $node: $node,
      node: $node[0],
      command: tokens[0],
      inputs: tokens.slice(1),
      key: key,

      _operation: $node._operation,

      _isDead: undefined,
      _shouldUpdate: undefined,
      _shouldUpdateBranch: undefined,

      _parent: undefined,
      _parentIsDead: undefined,
      _visitParentBranch: undefined,
      _gotParentInfo: undefined,

      _dirtyObservers: {},
      _scopeChain: undefined,
      _potentialObservers: []
    });

  };

  Directive.prototype = create(commands);
  Directive.prototype.constructor = Directive;

  extend(Directive.prototype, {

    $: function(node){ return this._operation.$(node); },

    toString: function(){ return [this.command].concat(this.inputs).join(' '); },

    uniqueKey: function(){
      return this.$node.key+' '+this.key;
    },

    lookup: function(key){
      var details = this.getScopeChain().detailedLookup(key);
      this._potentialObservers = this._potentialObservers.concat(details.potentialObservers);
      return details.value;
    },

    resetScopeChain: function(){
      this._scopeChain = emptyScopeChain;
    },

    pushScope: function(type, scope, options){
      this._scopeChain = this.getScopeChain().extend(type, scope, options);
    },

    getScopeChain: function(){
      return this._scopeChain = this._scopeChain || this.getParentScopeChain();
    },

    getScope: function(){
      return this.getScopeChain().scope;
    },

    dirtyObserver: function(observer){
      this._dirtyObservers[observer.key] = observer;
      return this.consider();
    },

    dirtyObserverPertains: function(){
      var key;
      for(key in this._dirtyObservers){
        if(this._dirtyObservers[key].pertains()){ return true; }
      }
    },

    // calling this method ensures that the directive (and all its parents) will be considered for updating in the operation, and considered for a rendering update
    consider: function(){
      return this._operation.visit(this);
    },

    update: function(){
      this._shouldUpdate = true;
      return this.consider();
    },

    updateBranch: function(){
      this._shouldUpdateBranch = true;
      return this.update();
    },

    dead: function(){
      this._isDead = true;
      return this;
    },

    onUpdate: function(callback){
      if(this.shouldUpdate() && callback){
        callback.call(this);
      }
      return this;
    },

    // the directive's command (for example, 'contain') will be executed with a 'this' context of that directive
    visit: function(){
      if(this._visited){ return; }
      this._visited = true;
      this.getParent().visit();
      var willUpdate = this.shouldUpdate();

      if(debugging){
        try {
          this._runCommand(this.command, this.inputs);
        } catch (error) {
          throw this._describeError(error);
        }
      } else {
        this._runCommand(this.command, this.inputs);
      }

      if(willUpdate){
        this._registerPotentialObservers();
        if(this.shouldUpdateBranch() && !this._operation.isSearched(this.$node)){
          this.search();
        }
      }
    },

    _runCommand: function(command, inputs){
      throwErrorIf(!this._operation.isRunning(), 'tried to .visit() a directive outside of operation.run()');
      throwErrorIf(!commands[command], 'not a valid react command: '+command);
      commands["resolve_"+command] || (commands["resolve_"+command] = commands["resolve_"+command] === false ? this._nonResolver : this._fullResolver);
      var args = commands["resolve_"+command].call(this, inputs);
      commands[command].apply(this, args);
    },

    _nonResolver: function(names){ return names; },

    _fullResolver: function(names){
      var that = this;
      return map(names, function(name){
        return that.lookup(name);
      });
    },

    _registerPotentialObservers: function(){
      var i, potentialObserver;
      for(i = 0; i < this._potentialObservers.length; i+=1){
        potentialObserver = this._potentialObservers[i];
        if(potentialObserver.scopeChain.anchorKey){
          new Proxy(this._operation, potentialObserver.scopeChain.scope).observe(potentialObserver.key, this, potentialObserver.scopeChain.prefix);
        }
      }
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
        'index of failed directive': this.$node.directives.getIndex(this.key),
        'scope chain description': this.getScopeChain().describe(),
        '(internal scope chain object) ': this.getScopeChain()
      });
      return error;
    },

    search: function(){
      // when considering updating the after directive of all descendant react nodes, we need to include the root as well, since we might be calling this on another earlier directive of that node
      var $nodes = this.$node.getReactNodes(), which;
      for(which = 0; which < $nodes.length; which+=1){
        // since the querySelectorAll operation finds ALL relevant descendants, we will not need to run it again on any of the children returned by the operation
        this._operation.isSearched($nodes[which], true);
        $nodes[which].directives.after.consider();
      }
    },

    _getParentInfo: function(){
      if(this._gotParentInfo){ return; }
      this._gotParentInfo = true;
      this._parent = this._parent || this.getParent();
      this._parentIsDead = this.parentIsDead();
      this._shouldUpdateParentBranch = this.shouldUpdateParentBranch();
      this._parentScopeChain = this._parentScopeChain || this._parent.getScopeChain();
    },

    getParentScopeChain: function(){
      this._getParentInfo();
      return this._parentScopeChain;
    },

    shouldUpdate: function(){
      this._getParentInfo();
      return !this.isDead() && (this._shouldUpdate = this._shouldUpdate || this._shouldUpdateParentBranch || this.dirtyObserverPertains());
    },

    shouldUpdateBranch: function(){
      this._getParentInfo();
      return this.shouldUpdate() && (this._shouldUpdateBranch || this._shouldUpdateParentBranch);
    },

    isDead: function(){
      this._getParentInfo();
      return this._isDead || this._parentIsDead;
    },

    shouldUpdateParentBranch: function(){
      return this._shouldUpdateParentBranch !== undefined ? this._shouldUpdateParentBranch : this.getParent().shouldUpdateBranch();
    },

    parentIsDead: function(){
      return this._parentIsDead !== undefined ? this._parentIsDead : this.getParent().isDead();
    },

    getParent: function(){
      if(this._parent !== undefined){ return this._parent; }
      var repeatLimit = 10000, parent;
      while(parent !== ( parent = this.$node.directives.potentialParentOf(this.key) )){
        parent && parent.visit();
        throwErrorIf(!(repeatLimit--), 'Too much parent reassignment'); //You've done something in your directive that makes the parent directive change every time the current parent runs. This is most likely caused by lookups to function properties that mutate the DOM structure
      }
      return (this._parent = parent);
    }

  });

  var nullDirective = {
    visit: noop,
    isDead: noop,
    shouldUpdate: noop,
    shouldUpdateBranch: noop,
    getScopeChain: function(){ return emptyScopeChain; },
    getParent: function(){ throwError('internal error: cannot get the parent of a null directive'); }
  };




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
      var that = this;
      each(filter(string.split(',')), function(right, left){
        that.map(left, right);
      });
    }

  });




  /*
   * Directive Set
   */

  var DirectiveSet = function($node){
    extend(this, {
      _$node: $node,
      _node: $node[0],
      _indexKeyPairs: new TwoWayMap($node.getMeta('indexKeyPairs')),
      _validatedDirectivesString: $node.getMeta('validatedDirectivesString') || $node.getDirectivesString()
    });
    throwErrorIf(this._validatedDirectivesString !== $node.getDirectivesString(), 'directives string changed manually since last visit');

    this.buildDirectives();
  };

  extend(DirectiveSet.prototype, {

    getByKey: function(key){ return this[this.getIndex(key)]; },

    getMeta: function(){ return this._$node.getMeta.apply(this._$node, arguments); },
    setMeta: function(){ return this._$node.setMeta.apply(this._$node, arguments); },

    buildDirectives: function(){
      var i;
      var $node = this._$node;
      var isInitialized = $node.isInitialized();
      var tokenArrays = $node.getDirectiveArrays();
      var anchoredTokens = tokenArrays[0] && tokenArrays[0][0] === 'anchored' ? tokenArrays.shift() : ['anchored'];

      extend(this, {
        length: tokenArrays.length,

        before: $node.makeDirective('before', ['before']),
        anchored: $node.makeDirective('anchored', anchoredTokens),
        after: $node.makeDirective('after', ['after'])
      });

      for(i = 0; i < tokenArrays.length; i++){
        this[i] = $node.makeDirective(isInitialized ? this.getKey(i) : this.makeKey(i), tokenArrays[i]);
      }
    },

    getKey: function(index){
      return matchers.specialDirective.test(index) ? index : this._indexKeyPairs.getRight(index);
    },

    getIndex: function(key){
      return matchers.specialDirective.test(key) ? key : this._indexKeyPairs.getLeft(key);
    },

    makeKey: function(index){
      var key = (this.getMeta('lastDirectiveKey') || 0) + 1;
      this.mapIndexToKey(index, key).setMeta('lastDirectiveKey', key);
      return key;
    },

    mapIndexToKey: function(index, key){
      throwErrorIf(matchers.specialDirective.test(index), 'cannot explicitly set keys for special directives');
      this._indexKeyPairs.map(index, key);
      return this;
    },

    releaseIndex: function(index){ return this._indexKeyPairs.releaseLeft(index); },

    releaseKey: function(key){ return this._indexKeyPairs.releaseRight(key); },


    // mutation methods

    set: function(index, tokens){
      var key = matchers.specialDirective.test(index) ? this.getKey(index) : (this.releaseKey(index), this.makeKey(index));
      this[index] = this._$node.makeDirective(key, tokens);

      return this.write();
    },

    push: function(tokens){
      this[this.length] = this._$node.makeDirective(this.makeKey(this.length), tokens);
      this.length += 1;

      return this.write();
    },

    unshift: function(tokens){
      for(var i = this.length-1; 0 <= i; i--){
        this[i+1] = this[i];
        this.releaseIndex(i);
        this.mapIndexToKey(i+1, this[i+1].key);
      }
      this[0] = this._$node.makeDirective(this.makeKey('0'), tokens);
      this.length += 1;

      return this.write();
    },

    write: function(){
      var newDirectivesString = this.toString();
      var currentDirectivesString = this._$node.getDirectivesString();
      throwErrorIf(currentDirectivesString !== this._validatedDirectivesString, 'conflicting change to directives attribute');

      this._$node.setDirectivesString(this._validatedDirectivesString = newDirectivesString).setMeta({
        validatedDirectivesString: newDirectivesString,
        indexKeyPairs: this._indexKeyPairs.toString()
      });
      return this;
    },

    orderedForString: function(){
      return (this.anchored.inputs.length ? [this.anchored] : []).concat(makeArrayFromArrayLikeObject(this));
    },

    potentialParentOf: function(key){
      var index = this.getIndex(key).toString();
      return (
        index === 'before' ? (
          this.anchored.inputs.length ? nullDirective :
          !this._$node.wrappedParent() ? nullDirective :
          this._$node.wrappedParent().directives.after
        ) :
        index === 'anchored' ? this.before :
        index === '0' ? this.anchored :
        index.match(matchers.isNumber) ? this[index-1] :
        index === 'after' ? (this.length ? this[this.length-1] : this.anchored) :
        throwError('invalid directive key')
      );
    },

    toString: function(){ return this.orderedForString().join(', '); }

  });




  /*
   * Proxy
   */

  // A proxy provides an interface for the observer relationship between any JS object and the nodes/directives observing it's properties
  var Proxy = function(operation, object){
    extend(this, {
      _operation: operation,
      _object: object,
      _cachedObservers: {}
    });
  };

  extend(Proxy.prototype, {
    // writes an association between a directive and a property on an object by annotating the object
    observe: function(key, directive, prefix){
      directive.$node.store();
      new Observer(this._operation, this._cachedObservers, this._object, key, directive.$node.key, directive.key, prefix).write();
    },

    changed: function(keys){
      // if no key is supplied, check every key
      if(!this._object || !this._object.observers){ return; }
      keys = (
        isArray(keys) ? keys :
        keys !== undefined ? [keys] :
        keysFor(this._object).concat('length' in this._object && !this._object.propertyIsEnumerable('length') ? ['length'] : [])
      );

      // we first need to collect all the observers of the changed keys
      var whichKey;
      for(whichKey = 0; whichKey < keys.length; whichKey+=1){
        var key = keys[whichKey];
        if(!this._object.observers[key]){ continue; } // if there are no observers for the supplied key, do nothing
        var keyObserverString;
        for(keyObserverString in this._object.observers[key]){
          var observerTokens = Observer.parseKeyObserverString(keyObserverString);
          new Observer(this._operation, this._cachedObservers, this._object, key, observerTokens.nodeKey, observerTokens.directiveKey, observerTokens.prefix).dirty();
        }
      }
    }
  });



  /*
   * Observer
   */

  var Observer = function(operation, cachedObservers, object, propertyKey, nodeKey, directiveKey, prefix){
    var observerDetailsString = nodeKey+' '+directiveKey+' '+prefix;
    var observerKey = propertyKey+' '+observerDetailsString;
    if(cachedObservers[observerKey]){ return cachedObservers[observerKey]; }

    cachedObservers[observerKey] = extend(this, {
      object: object,
      propertyKey: propertyKey,
      observerDetailsString: observerDetailsString,
      prefix: prefix,
      directive: operation.$(react.nodes[nodeKey]).directives.getByKey(directiveKey),
      key: observerKey
    });
  };

  Observer.parseKeyObserverString = function(keyObserverString){
    var tokens = keyObserverString.split(matchers.space);
    return {
      nodeKey: tokens[0],
      directiveKey: tokens[1],
      prefix: tokens[2]
    };
  };

  extend(Observer.prototype, {

    write: function(){
      var observers = this.object.observers = this.object.observers || {};
      var propertyObservers = observers[this.propertyKey] = observers[this.propertyKey] || {};
      propertyObservers[this.observerDetailsString] = true;
    },

    dirty: function(){
      if(this.isDirty){ return; }
      this.isDirty = true;
      this.directive.dirtyObserver(this);
    },

    pertains: function(){
      // ignore the object if it's not in the same path that lead to registration of the observer
      return this.directive.getScopeChain().detailedLookup(this.prefix + this.propertyKey, {checkFocus: this.object}).didMatchFocus;
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
      this._runCommand(commandKey, Array.prototype.slice.call(arguments, 1));
    },

    resolve_debugIf: false,
    debugIf: function(conditionKey, commandKey){
      if(this.lookup(conditionKey)){ debugger; }
      this._runCommand(commandKey, Array.prototype.slice.call(arguments, 2));
    },

    before: function(){
      if(this.$node.hasClass('reactItemTemplate')){
        this.dead();
      }
    },

    after: noop,

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
        this.$node.removeClass('reactConditionallyHidden');
        this.pushScope(type, scope, {key:key});
      }else{
        this.$node.addClass('reactConditionallyHidden');
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
        this.$(itemNode).directives.unshift(['withinItem', index]);
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
      var aliases = Array.prototype.slice.call(arguments);
      this.onUpdate(function(){
        // todo: return here (and everywhere else) if collection is undefined.  test for this
        this._createItemNodes(function(index, itemNode){
          this.$(itemNode).directives.unshift( ['bindItem', index].concat(aliases) );
        });
        this.updateBranch();
      });
    },

    _createItemNodes: function(callback){
      var $children = this.$node.children();
      var $itemTemplate = $children.first().addClass('reactItemTemplate');
      if(!$itemTemplate.length){ return; }

      var collection = this.getScope();
      if(!isArray(collection)){ return this.dead(); }
      // this ensures that the directive will depend upon any changes to the length of the array
      this.lookup('length');

      var itemNodes = [], pregeneratedItemCount = 0, lastPregeneratedItem = $itemTemplate, itemsToRemove = [], i;
      for(i = 1; i < $children.length; i+=1){
        if(this.$($children[i]).hasClass('reactItem')){
          pregeneratedItemCount+=1;
          collection.length < pregeneratedItemCount ? itemsToRemove.push($children[i]) : (lastPregeneratedItem = $children[i]);
        }
      }
      var newItems = [], newItem;
      for(i = pregeneratedItemCount; i < collection.length; i+=1){
        callback.call(this, i, newItem = $itemTemplate.clone().removeClass('reactItemTemplate').addClass('reactItem')[0]);
        this.$(newItem).directives.before.updateBranch();
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
        this.$node.directives.after.dead();
      });
      this.$node.directives.after.resetScopeChain();
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
        if(!among(['string', 'number', 'undefined'], typeof name)){
          log('bad attr name: ', name);
          throwError('expected attr name token ' + name + ' to resolve to a string, a number, null, or undefined, not ' + typeof name);
        }else if(!among(['string', 'number', 'undefined'], typeof value)){
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

  if(window.jQuery){
    react.integrate.jQuery();
  }

  window.react = react;

}());
