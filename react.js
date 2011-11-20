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

  var debugging = false;

  var matchers = {
    directiveDelimiter: /\s*,\s*/,
    space: /\s+/,
    negation: /!\s*/,
    isString: /(^'.*'$)|(^".*"$)/,
    isNumber: /^\d+$/
  };

  // returns a unique, consistent key for every node
  var getNodeKey = function(node){
    var key = jQuery(node).data("reactKey");
    if(!key){
      key = js.util.unique('reactNode');
      jQuery(node).data("reactKey", key);
    }
    return key;
  };

  var getScopeKey = function(object){
    return (object.reactKey = object.reactKey || js.util.unique('reactObject'));
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
      js.errorIf(object.reactKey, 'You tried to name a scope object that already had a name');
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
        js.errorIf(node.length !== 1, 'you cannot pass a jquery object containing many nodes to react.update()');
        node = node[0];
      }
      js.errorIf(!node, 'you did not pass a valid node to react.update()');
      var operation = new Operation();
      operation.$(node).directives.before.updateBranch();
      operation.run();
      return input;
    },

    anchor: function(node){
      var scopes = Array.prototype.slice.call(arguments, 1);
      this.nodes[getNodeKey(node)] = node;
      // todo: clean up any links elsewhere (like listeners) that are left by potential existing anchors

      new Operation().$(node).directives.set('anchored', ['anchored'].concat(js.map(scopes, function(i, scope){
        var scopeKey = getScopeKey(scopes[i]);
        react.scopes[scopeKey] = scopes[i];
        return scopeKey;
      })));

      return react.update(node);
    },

    helpers: js.extend(function(focus, deeply){
      js.extend(focus, react.helpers);

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
        if(typeof key === 'object'){
          var newValues = key;
        } else {
          newValues = {};
          newValues[key] = value;
        }
        for(key in newValues){
          this[key] = newValues[key];
        }
        react.changed(this, js.keys(newValues));
      },

      del: function(keys){
        var i;
        keys = js.isArray(keys) ? keys : [keys];
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
        var singularize = function(which, method){
          return function(){
            js.errorIf(this.length !== 1, 'react\'s jQuery helpers can only be run on jQuery objects containing a single member');
            return method.apply(this, arguments);
          };
        };

        jQuery.fn.extend(js.map({

          update: function(){ return react.update(this); },

          anchor: function(){
            if(!arguments.length){
              var scopes = this.anchors();
              js.errorIf(scopes.length !== 1, '.anchor() can only be called on nodes with a single anchored object');
              return scopes[0];
            }
            return react.anchor.apply(react, [this].concat(Array.prototype.slice.call(arguments)));
          },

          anchors: function(){
            return js.map(new Operation().$(this[0]).directives.anchored.inputs, function(which, scopeName){
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

    js.extend(this, {
      parent: previousLink,
      scope: additionalScope,
      type: type,
      key: options.key,
      prefix: options.prefix || '',
      // todo this shouldn't need a prefix
      anchorKey: options.anchorKey || (type === 'anchor' ? options.key : (previousLink||{}).anchorKey),
    });
  };

  js.extend(ScopeChain.prototype, {

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
        js.errorIf(negate, 'You can\'t negate literals using the exlamation point');
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
    js.extend(this, {

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

  js.extend(Operation.prototype, {

    $: function(node){
      return this._$nodes[getNodeKey(node)] || (this._$nodes[getNodeKey(node)] = new NodeWrapper(this, node));
    },

    hasRun: function(){ return this._hasRun; },

    isRunning: function(){ return this._isRunning; },

    visit: function(directive){ this._toVisit[directive.key] = directive; },

    isSearched: function($node, setting){
      if(setting === undefined){
        this._searched[$node.key] = setting;
      } else {
        return this._searched[$node.key];
      }
    },

    run: function(){
      var limit = 10000,
          key;
      js.errorIf(this._hasRun, 'An operation cannot be run twice');
      this._isRunning = true;
      // iterating over the toVisit list once isn't sufficient. Since considering a directive might extend the list, and order of elements in a hash is not guarenteed
      while(js.hasKeys(this._toVisit)){
        js.errorIf(!(--limit), 'too many node additions');
        for(key in this._toVisit){
          js.errorIf(this._visited[key], 'tried to consider the same directive twice');
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
    js.errorIf(!node || node.nodeType !== 1 || js.isArray[node] || node instanceof jQuery, 'node arg must be a DOM node');

    jQuery.prototype.init.call(this, node);

    js.extend(this, {
      node: node,
      key: getNodeKey(node),
      _operation: operation
    });

    this.directives = new DirectiveSet(this);
  };

  NodeWrapper.prototype = js.create(jQuery.prototype, {
    // a correct constructor mapping breaks with jquery, because it calls this.constructor() with no arguments
    // constructor: NodeWrapper

    makeDirective: function(index, tokens){ return new Directive(this, index, tokens); },

    getDirectivesString: function(){
      return this.attr('react') || '';
    },

    getDirectiveStrings: function(){
      return js.map(this.getDirectivesString().split(matchers.directiveDelimiter), function(which, string){
        return js.trim(string).replace(matchers.negation, '!').replace(matchers.space, ' ');
      });
    },

    getDirectiveArrays: function(){
      return js.reduce(this.getDirectiveStrings(), [], function(which, string, memo){
        return string ? memo.concat([js.trim(string).split(matchers.space)]) : memo;
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

    // note: getReactDescendants() only returns descendant nodes that have a 'react' attribute on them. any other nodes of interest to react (such as item templates that lack a 'react' attr) will not be included
    getReactDescendants: function(){
      var that = this;

      // todo: optimize selection criteria
      // return js.map(makeArrayFromArrayLikeObject(this.find('[react]:not([:data-anchored-to]):not([:data-anchored-to] *)')), function(which, node){

      return js.map(makeArrayFromArrayLikeObject(this.find('[react]')), function(which, node){
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
  var Directive = function($node, index, tokens){
    js.extend(this, {
      $node: $node,
      node: $node[0],
      command: tokens[0],
      inputs: tokens.slice(1),

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

    this.setIndex(index);
  };

  Directive.prototype = js.create(commands);
  Directive.prototype.constructor = Directive;

  js.extend(Directive.prototype, {

    $: function(node){ return this._operation.$(node); },

    toString: function(){ return [this.command].concat(this.inputs).join(' '); },

    setIndex: function(newIndex){
      this.index = newIndex;
      this.key = this.$node.key+' '+this.index;
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
      js.errorIf(!this._operation.isRunning(), 'tried to .visit() a directive outside of operation.run()');
      js.errorIf(!commands[command], 'not a valid react command: '+command);
      commands["resolve_"+command] || (commands["resolve_"+command] = commands["resolve_"+command] === false ? this._nonResolver : this._fullResolver);
      var args = commands["resolve_"+command].call(this, inputs);
      commands[command].apply(this, args);
    },

    _nonResolver: function(names){ return names; },

    _fullResolver: function(names){
      var that = this;
      return js.map(names, function(which, name){
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
      js.log('Failure during React update: ', {
        'original error': error,
        'original stack': error.stack && error.stack.split ? error.stack.split('\n') : error.stack,
        'while processing node': this.node,
        'index of failed directive': this.index,
        'directive call': this.command+'('+this.inputs.join(', ')+')'
      }, '(Supplemental dynamic data follows)');
      js.log('Supplemental: ', {
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
      while(parent !== (parent = this._potentialParent())){
        parent && parent.visit();
        js.errorIf(!(repeatLimit--), 'Too much parent reassignment'); //You've done something in your directive that makes the parent directive change every time the current parent runs. This is most likely caused by lookups to function properties that mutate the DOM structure
      }
      return (this._parent = parent);
    },

    _potentialParent: function(){
      return (
        (this.command === "before" && this.$node.directives.anchored.inputs.length) ? nullDirective :
        this.index === 'before' ? (this.$node.wrappedParent() ? this.$node.wrappedParent().directives.after : nullDirective) :
        this.index === 'anchored' ? this.$node.directives.before :
        this.index.toString() === '0' ? this.$node.directives.anchored :
        this.index.toString().match(matchers.isNumber) ? this.$node.directives[this.index-1] :
        this.index === 'after' ? (this.$node.directives.length ? this.$node.directives[this.$node.directives.length-1] : this.$node.directives.anchored) :
        js.error('invalid directive key')
      );
    }

  });

  var nullDirective = {
    visit: noop,
    isDead: noop,
    shouldUpdate: noop,
    shouldUpdateBranch: noop,
    getScopeChain: function(){ return emptyScopeChain; },
    getParent: function(){ js.error('internal error: cannot get the parent of a null directive'); }
  };




  /*
   * Directive Set
   */

  var DirectiveSet = function($node){
    var i,
        key,
        tokens,
        tokenArrays = $node.getDirectiveArrays(),
        validatedDirectivesString = $node.data('validatedDirectivesString');

    this.length = 0;

    for(i = 0; i < tokenArrays.length; i++){
      tokens = tokenArrays[i];
      if(i === 0 && tokens[0] === 'anchored'){
        this.anchored = $node.makeDirective('anchored', tokens);
      } else {
        key = (this.anchored ? i-1 : i).toString();
        this.push($node.makeDirective(key, tokens));
      }
    }

    js.extend(this, {
      _$node: $node,

      before: $node.makeDirective('before', ['before']),
      anchored: this.anchored || $node.makeDirective('anchored', ['anchored']),
      after: $node.makeDirective('after', ['after'])
    });

    if(validatedDirectivesString === undefined){
      $node.data('validatedDirectiveString', validatedDirectivesString = this.toString());
    }

    this.write();
    js.errorIf(validatedDirectivesString !== $node.getDirectivesString(), 'invalid change to react string');
  };

  js.extend(DirectiveSet.prototype, {

    push: function(element){
      this[this.length] = element;
      this.length += 1;
    },

    unshift: function(element){
      for(var i = this.length-1; 0 <= i; i--){
        this[i+1] = this[i];
      }
      this[0] = element;
      this.length += 1;
    },

    // todo: this takes an array, rather than a directive object. that seems odd, but directive objects aren't makable outside this scope
    set: function(key, directive){
      this[key] = this._$node.makeDirective(''+key, directive);
      this.write();
      return this;
    },

    write: function(){
      this._$node.attr('react', this.toString()).data('validatedDirectivesString', this.toString());
    },

    orderedForString: function(){
      return (this.anchored.inputs.length ? [this.anchored] : []).concat(makeArrayFromArrayLikeObject(this));
    },

    toString: function(){
      return js.map(this.orderedForString(), function(which, directive){
        if(!(directive instanceof Directive) && console){ console.log('oops - something\'s wrong with your directives'); }
        return directive.toString();
      }).join(', ');
    },

    prepend: function(directive){
      directive = directive instanceof Directive ? directive : this._$node.makeDirective('0', directive);
      this.unshift(directive);

      js.map(this, function(which, directive){
        directive.setIndex(which.toString());
      });
      this.write();
    }

  });




  /*
   * Proxy
   */

  // A proxy provides an interface for the observer relationship between any JS object and the nodes/directives observing it's properties
  var Proxy = function(operation, object){
    js.extend(this, {
      _operation: operation,
      _object: object,
      _cachedObservers: {}
    });
  };

  js.extend(Proxy.prototype, {
    // writes an association between a directive and a property on an object by annotating the object
    observe: function(key, directive, prefix){
      directive.$node.store();
      new Observer(this._operation, this._cachedObservers, this._object, key, directive.$node.key, directive.index, prefix).write();
    },

    changed: function(keys){
      // if no key is supplied, check every key
      if(!this._object || !this._object.observers){ return; }
      keys = (
        js.isArray(keys) ? keys :
        keys !== undefined ? [keys] :
        js.keys(this._object).concat('length' in this._object && !this._object.propertyIsEnumerable('length') ? ['length'] : [])
      );

      // we first need to collect all the observers of the changed keys
      var whichKey;
      for(whichKey = 0; whichKey < keys.length; whichKey+=1){
        var key = keys[whichKey];
        if(!this._object.observers[key]){ continue; } // if there are no observers for the supplied key, do nothing
        var keyObserverString;
        for(keyObserverString in this._object.observers[key]){
          new Observer(this._operation, this._cachedObservers, this._object, key, keyObserverString).dirty();
        }
      }
    }
  });



  /*
   * Observer
   */

  var Observer = function(operation, cachedObservers, object, propertyKey, nodeKey, directiveIndex, prefix){
    if(arguments.length === 5){
      var tokens = nodeKey.split(matchers.space);
      nodeKey = tokens[0];
      directiveIndex = tokens[1];
      prefix = tokens[2];
    }

    var observerDetailsString = nodeKey+' '+directiveIndex+' '+prefix;
    var observerKey = propertyKey+' '+observerDetailsString;
    if(cachedObservers[observerKey]){ return cachedObservers[observerKey]; }

    cachedObservers[observerKey] = js.extend(this, {
      object: object,
      propertyKey: propertyKey,
      observerDetailsString: observerDetailsString,
      prefix: prefix,
      directive: operation.$(react.nodes[nodeKey]).directives[directiveIndex],
      key: observerKey
    });
  };

  js.extend(Observer.prototype, {

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

  js.extend(react.commands, {

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
      if(js.isArray(this.getScope()) && +key < this.getScope().length && this.getScope()[key]){
        this._withScope('withinItem', key);
      }else{
        this.dead();
      }
    },

    withinEach: function(){
      this._createItemNodes(function(index, itemNode){
        this.$(itemNode).directives.prepend(['withinItem', index]);
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
          this.$(itemNode).directives.prepend( ['bindItem', index].concat(aliases) );
        });
        this.updateBranch();
      });
    },

    _createItemNodes: function(callback){
      var $children = this.$node.children();
      var $itemTemplate = $children.first().addClass('reactItemTemplate');
      if(!$itemTemplate.length){ return; }

      var collection = this.getScope();
      if(!js.isArray(collection)){ return this.dead(); }
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
      js.errorIf(arguments.length !== 2, 'the attr directive requires 2 arguments');
      this.onUpdate(function(){
        if(!js.among(['string', 'number', 'undefined'], typeof name)){
          js.log('bad attr name: ', name);
          js.error('expected attr name token ' + name + ' to resolve to a string, a number, null, or undefined, not ' + typeof name);
        }else if(!js.among(['string', 'number', 'undefined'], typeof value)){
          js.log('bad attr value: ', value);
          js.error('expected attr value token ' + value + ' to resolve to a string, a number, null, or undefined, not ' + typeof value);
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
