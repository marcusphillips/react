/*!
 * React for JavaScript - an easy-rerender template language
 * Version 1.3.2, http://github.com/marcusphillips/react
 *
 * Copyright 2010, Marcus Phillips
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function(undefined) {

  /*
   * Library-wide helpers
   */

  var global = this;
  // import js.* and other utilities into this scope
  var among = js.among, bind = js.bind, catchIf = js.catchIf, clear = js.clear, concatArrays = js.concatArrays, create = js.create, curry = js.curry, each = js.each, exhaust = js.exhaust, extend = js.extend, filter = js.filter, has = js.has, hasKeys = js.hasKeys, isArray = js.isArray, keysFor = js.keys, log = js.log, map = js.map, noop = js.noop, reduce = js.reduce, Set = js.Set, slice = js.slice, throwError = js.error, throwErrorIf = js.errorIf, toArray = js.toArray, trim = js.trim;
  var boundProxy = bound.proxy;

  var debugging = false;
  var specialDirectives = {before: true, anchored: true, after: true};
  var matchers = {
    directiveDelimiter: /\s*,\s*/,
    space: /\s+/,
    negation: /!\s*/,
    isString: /(^'.*'$)|(^".*"$)/,
    isNumber: /^\d+$/
  };

  // returns a unique, consistent key for every node
  var getNodeKey = function(node){ return boundProxy(node instanceof jQuery ? node[0] : node).key; };

  // Fallthroughs provide a mechanism for binding one key in a scope to the value at another key
  var Fallthrough = function(key){ this.key = key; };


  /*
   * Library interface
   */

  var react = {

    debug: function(){ debugging = true; },
    name: function(){ console && console.warn('react.name() is deprecated'); },
    reset: function(){ console && console.warn('react.reset() is deprecated'); },

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
      operation.makeMetaNode(node).getDirective('before').updateBranch();
      operation.run();
      return input;
    },

    anchor: function(node){
      // todo: clean up any links elsewhere (like listeners) that are left by potential existing anchors
      $$(node).extend({anchors: slice(arguments, 1)}).setDirective('anchored', ['anchored']).update();
      return node;
    },

    helpers: extend(function(focus, deeply){
      extend(focus, react.helpers);
      deeply && each(focus, function(item, key){
        key !== 'set' && item && typeof item === 'object' && !item.set && react.helpers(item, deeply);
      });
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
        each(isArray(keys) ? keys : [keys], function(key){
          delete this[key];
        }, this);
        react.changed(this, keys);
      },

      changed: function(){ react.changed(this); }

    }),

    integrate: {

      Backbone: function(){
        var changeMatcher = /^change:/;
        Backbone.ReactiveModel = Backbone.Model.extend({
          constructor: function(options){
            Backbone.Model.apply(this, arguments);
            this.JSON = this.toJSON();
            this.bind('all', function(eventName){
              if(eventName.match(changeMatcher)){
                var key = eventName.slice(7);
                this.JSON[key] = this.get(key);
                console.log(key, this.JSON);
                react.changed(this.JSON, key);
              }
            }, this);
          }
        });
      },

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
            throwErrorIf(!arguments.length && this.anchors().length !== 1, '.anchor() can only be called on nodes with a single anchored object');
            return arguments.length ? react.anchor.apply(react, [this].concat(slice(arguments))) : this.anchors()[0];
          },

          anchors: function(){ return $$(this).anchors; },

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
    },

    commands: {}

  };

  var commands = react.commands;




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
      prefix: options.prefix || ''
      // todo this shouldn't need a prefix
    });
  };

  extend(ScopeChain.prototype, {

    contains: function(scope){ return this.scope === scope || (this.parent && this.parent.contains(scope)); },
    extend: function(type, additionalScope, options){ return new ScopeChain(type, this, additionalScope, options); },
    extendWithMany: function(type, scopes, options){
      return reduce(scopes || [], this, function(memo, scope){
        memo.extend(type, scope, options);
      });
    },

    lookup: function(){ return this.resolve.apply(this, arguments).value; },
    resolve: function(pathString, options){ return new Resolution(this, pathString, options); },

    // provides a description of the scope chain in array format, optimized for viewing in the console
    describe: function(){
      return [
        ['scope: ', this.scope, ', type of scope shift: ' + this.type + (this.prefix ? ' (prefix: '+this.prefix+')': '')]
      ].concat(this.parent ? this.parent.describe() : []);
    }

  });

  var emptyScopeChain = new ScopeChain('empty');
  // all lookups fail in the empty scope chain
  emptyScopeChain.resolve = function(){ return {failed: true, potentialObservers: []}; };




  /*
   * Resolution
   */

  // provides the value at a given path key, by looking through the scope chain from a given link upwards
  var Resolution = function(scopeChain, pathString, options){
    pathString = isArray(pathString) ? pathString.join('.') : pathString.toString();
    extend(this, {lowestScopeChain: scopeChain, potentialObservers: [], options: options || {}});
    var negate = pathString[0] === '!';
    negate && (pathString = pathString.slice(1));

    if(matchers.isString.test(pathString)){
      return extend(this, {value: pathString.slice(1, pathString.length-1)});
    };

    var path = pathString.split('.');
    this.resolveName(path.shift(), path);
    typeof this.value === 'function' && (this.value = this.value.call(this.lowestScopeChain.scope));
    negate && (this.value = !this.value);
  };

  extend(Resolution.prototype, {

    resolveName: function(key, path){
      var originalKey = key;
      var value;
      while((value = this.lowestScopeChain.scope[key]) instanceof Fallthrough){
        // a Fallthrough object remaps a key to a different key in the parent scope (acts as binding)
        this.lowestScopeChain = this.lowestScopeChain.parent;
        key = value.key;
      }

      this.potentialObservers.push({scopeChain: this.lowestScopeChain, key: key});

      this.didMatchFocus || (this.didMatchFocus = this.options.checkFocus === this.lowestScopeChain.scope);

      // recurse onto the parent scopeChain if the lookup fails at this level
      this.extend(has(this.lowestScopeChain.scope, key) ? {value: value} : this.lowestScopeChain.parent.resolve(key, this.options));

      // for dot access
      path.length && this.value && this.extend(emptyScopeChain.extend('dotAccess', this.value, {
        prefix: this.lowestScopeChain.prefix + originalKey + '.'
      }).resolve(path, this.options));
    },

    extend: function(moreDetails){
      moreDetails || (moreDetails = {});
      return extend(this, moreDetails, {
        potentialObservers: (this.potentialObservers || []).concat(moreDetails.potentialObservers || []),
        didMatchFocus: this.didMatchFocus || moreDetails.didMatchFocus
      });
    }

  });


  /*
   * Operation
   */

  // An operation provides a shared context where complex interactions may rely upon shared state

  var Operation = function(){
    // directives we plan to visit, by key
    // to ensure root-first processing order, we earmark each directive we plan to follow, then follow them all during the run() step
    extend(this, { _toVisit: makeDirectiveSet(), _metaObservers: [], _metaNodes: {}, _hasRun: false, _isRunning: false });
  };

  extend(Operation.prototype, {

    makeMetaNode: function(node){ return this._metaNodes[getNodeKey(node)] || (this._metaNodes[getNodeKey(node)] = $$(node).makeMeta(this)); },

    hasRun: function(){ return this._hasRun; },
    isRunning: function(){ return this._isRunning; },

    visit: function(directive){ return this._toVisit.add(directive); },

    run: function(){
      throwErrorIf(this._hasRun || this._isRunning, 'An operation cannot be run twice');
      extend(this, {_isRunning: true});
      // iterating over the toVisit list once isn't sufficient, we have to exhaust the hash of keys. Since considering a directive might have the effect of extending the hash further, and order of elements in a hash is not guarenteed
      this._toVisit.exhaust(['visit']);
      extend(this, {_isRunning: false, _hasRun: true});
    },

    changed: function(object, keys){
      keys = (
        isArray(keys) ? keys :
        keys !== undefined ? [keys] :
        keysFor(object).concat(has(object, 'length') && !object.propertyIsEnumerable('length') ? ['length'] : [])
      );

      each(keys, function(key){
        each(toArray(boundProxy(object).observersByProperty[key] || {}), function(observer){
          this.getMetaObserver(observer).dirty();
        }, this);
      }, this);
      return this;
    },

    getMetaObserver: function(observer){
      return this._metaObservers[observer.key] || (this._metaObservers[observer.key] = new MetaObserver(this, observer));
    }

  });




  /*
   * $$ (subclass of jQuery)
   */

  // Overriding jQuery to provide supplemental functionality to DOM node wrappers
  // Within the scope of the Operation constructor, all calls to $$() return a customized jQuery object. For access to the original, use jQuery()
  var $$ = function(node){
    node && has(node, 'length') && (node = node[0]);
    throwErrorIf(!node || node.nodeType !== 1, 'node arg must be a single DOM node');
    var proxy = boundProxy(node);
    var $$node = proxy.meta('$$node');
    throwErrorIf($$node && $$node.directives._validatedDirectivesString !== $$node.getDirectivesString(), 'directives string changed manually since last visit');
    return $$node || proxy.meta('$$node', new _$$(node)).meta('$$node');
  };

  var _$$ = function(node){
    jQuery.prototype.init.call(this, node);
    extend(this, {
      node: node,
      key: getNodeKey(node),
      anchors: []
    });
    extend(this, {
      directives: new DirectiveList(this)
    });
    this.getStorage('initialized') || this.initializeNode();
  };

  _$$.prototype = create(jQuery.prototype, {
    // note: a correct mapping of the .constructor property to $$ breaks jquery, since it calls new this.constructor() with no arguments

    makeMeta: function(operation){ return new MetaNode(this, operation); },
    makeDirective: function(key, tokens){ return new Directive(this, key, tokens); },
    getDirective: function(key){ return this.directives.getByKey(key); },
    setDirective: function(key, tokens){
      this.directives.set(key, tokens);
      return this;
    },

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
        string && memo.push(trim(string).split(matchers.space));
      });
    }

  });


  /*
   * MetaNode (metadata for operations, about nodes)
   */

  var MetaNode = function($$node, operation){
    extend(this, {
      $$node: $$node,
      metaDirectives: {},
      operation: operation,
      _isSearched: undefined
    });
  };

  extend(MetaNode.prototype, {

    getDirective: function(key){ return this.metaDirectives[key] || (this.metaDirectives[key] = this.$$node.getDirective(key).makeMeta(this)); },

    wrappedParent: function(){
      var parent = this.$$node.parent()[0];
      return (
        ! parent ? null :
        parent === document ? null :
        this.operation.makeMetaNode(parent)
      );
    },

    getReactNodes: function(){ return [this].concat(this.getReactDescendants()); },

    // note: getReactDescendants() only returns descendant nodes that have a 'react' attribute on them. any other nodes of interest to react (such as item templates that lack a 'react' attr) will not be included
    // todo: optimize selection criteria
    // return map(toArray(this.find('[react]:not([:data-anchored-to]):not([:data-anchored-to] *)')), function(node){
    getReactDescendants: function(){
      return map((this.$$node.find('[react]')), bind(this.operation.makeMetaNode, this.operation));
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
      key: key,
      observers: {}
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
      _operation: metaNode.operation,
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

    $: function(node){ return this._operation.makeMetaNode(node); },
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
      var details = this.getScopeChain().resolve(key);
      this._potentialObservers = this._potentialObservers.concat(details.potentialObservers);
      return details.value;
    },

    dirtyObserver: function(observer){
      this._dirtyObservers[observer.key] = observer;
      return this.consider();
    },

    dirtyObserverPertains: function(){
      return reduce(this._dirtyObservers, false, function(memo, observer){
        // ignore the object if it's not in the same path that lead to registration of the observer
        return memo || this.getScopeChain().resolve(observer.prefix + observer.propertyKey, {checkFocus: observer.object}).didMatchFocus;
      }, this);
    },

    onUpdate: function(callback, context){
      this.shouldUpdate() && callback && callback.call(context || this);
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

      if(willUpdate) {
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
      each(this._potentialObservers, function(potentialObserver){
        new Observer(this.directive, potentialObserver.scopeChain.scope, potentialObserver.key, potentialObserver.scopeChain.prefix);
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
          this.$$node.anchors.length ? nullDirective :
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
  };

  extend(DirectiveList.prototype, {

    toString: function(){ return this.orderedForString().join(', '); },
    orderedForString: function(){ return (this.$$node.anchors.length ? [this.anchored] : []).concat(toArray(this)); },

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
   * Observer
   */

  var Observer = function(directive, object, propertyKey, prefix){
    var proxy = boundProxy(object);
    var key = [directive.uniqueKey(), propertyKey, prefix].join(' ');
    var observersByProperty = proxy.observersByProperty[propertyKey] || (proxy.observersByProperty[propertyKey] = {});
    return proxy.observers[key] || (proxy.observers[key] = observersByProperty[key] = directive.observers[key] = extend(this, {
      object: object,
      propertyKey: propertyKey,
      prefix: prefix,
      directive: directive,
      key: key
    }));
  };

//asdf change directive keys to be based on the (normalized) strings of their definition




  /*
   * MetaObserver
   */

  var MetaObserver = function(operation, observer){
    extend(this, {
      operation: operation,
      observer: observer
    });
  };

  extend(MetaObserver.prototype, {
    dirty: function(){
      this.operation.makeMetaNode(this.observer.directive.$$node).getDirective(this.observer.directive.key).dirtyObserver(this.observer);
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

    value: function(key){
      this.$$node.val(this.lookup(key));
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
    anchored: function(){
      each(this.$$node.anchors, function(anchor){ this.pushScope('anchor', anchor); }, this);
      this.onUpdate(this.updateBranch, this);
    },


    resolve_within: false,
    within: function(key){
      this._withScope('within', key);
    },

    _withScope: function(type, key){
      var scope = this.lookup(key);
      this.onUpdate(this.updateBranch, this);
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
      this.onUpdate(function() {
        this._createItemNodes(function(index, itemNode){
          this.$(itemNode).$$node.directives.unshift(['withinItem', index]);
        });
        this.updateBranch();
      }, this);
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

      this.onUpdate(this.updateBranch, this);
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
      this.onUpdate(function(){
        $(this.node)[condition ? 'removeClass' : 'addClass']('reactConditionallyHidden');
        this._conditionalShow(condition);
        this.updateBranch();
      });
      if(!condition){ this.dead(); }
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

  global.jQuery && react.integrate.jQuery();
  global.Backbone && react.integrate.Backbone();
  global.react = react;

}());
