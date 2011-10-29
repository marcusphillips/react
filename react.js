/*!
 * React for JavaScript - an easy-rerender template language
 * Version 1.2.3, http://github.com/marcusphillips/react
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
   * Scope chains
   */

  // Scope chains are used to model namespace lookup behavior in templates
  // all scope chains are built by calling emptyScopeChain.extend()
  var emptyScopeChain = (function(){

    // helper for creating the result (emptyScopeChain) and future scope chains returned from .extend()
    var ScopeChain = function(type, previousLink, additionalScope, options){
      options = options || {};

      var scopeChain = {
        parent: previousLink,
        scope: additionalScope,
        type: type,
        key: options.key,
        prefix: options.prefix || '',
// asdf this shouldn't need a prefix
        anchorKey: options.anchorKey || (type === 'anchor' ? options.key : (previousLink||{}).anchorKey),

        contains: function(scope){
          return scopeChain.scope === scope || (scopeChain.parent && scopeChain.parent.contains(scope));
        },

        extend: function(type, additionalScope, options){
          return new ScopeChain(type, scopeChain, additionalScope, options);
        },

        extendWithMany: function(type, scopes, options){
          scopes = scopes || [];
          var lastLink = scopeChain;
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
          if(scopeChain === emptyScopeChain){
            return extendDetails({failed:true});
          }

          if (matchers.isString.test(key)) {
            js.errorIf(negate, 'You can\'t negate literals using the exlamation point');
            return extendDetails({value: key.slice(1, key.length-1)});
          }

          var path = key.split('.');
          // base key is the first segment of a path that uses dot access. It's is the only segment that will be taken from the current scope chain
          var baseKey = path.shift();
          var value = scopeChain.scope[baseKey];

          // a Fallthrough object remaps the baseKey to a new baseKey in the previous scope
          if(value instanceof Fallthrough){
            return extendDetails(scopeChain.parent.detailedLookup( [value.key].concat(path).join('.'), options ));
          }

          details.potentialObservers.push({scopeChain: scopeChain, key: baseKey});
          details.didMatchFocus = details.didMatchFocus || (!path.length && options.checkFocus && options.checkFocus === scopeChain.scope);
          // recurse onto the parent scopeChain if the lookup fails at this level
          if(! (baseKey in scopeChain.scope) ){
            return extendDetails(scopeChain.parent.detailedLookup(key, options));
          }

          // for dot access
          if(path.length){
            if(value === undefined || value === null){
              // Could not find the key on a null or undefined object at path scopeChain.prefix+baseKey from scopeChain.scope
              return extendDetails();
            }
            return extendDetails(emptyScopeChain.extend('dotAccess', value, {
              // asdf - i think this needs to pass a key
              prefix: scopeChain.prefix + baseKey + '.',
              anchorKey: scopeChain.anchorKey
            }).detailedLookup(path.join('.'), options));
          }

          // functions are called before being returned
          value = typeof value === 'function' ? value.call(scopeChain.scope) : value;

          return extendDetails({value: value});
        },

        lookup: function(){
          return scopeChain.detailedLookup.apply(scopeChain, arguments).value;
        },

        // provides a description of the scope chain in array format, optimized for viewing in the console
        describe: function(){
          return [
            ['scope: ', scopeChain.scope, ', type of scope shift: ' + scopeChain.type + (scopeChain.key ? ' (key: '+scopeChain.key+')': '') + (scopeChain.anchorKey ? ', anchored to: '+scopeChain.anchorKey+')': '')]
          ].concat(scopeChain.parent ? scopeChain.parent.describe() : []);
        }

      };

      return scopeChain;
    };

    var emptyScopeChain = new ScopeChain('empty');
    return emptyScopeChain;
  }());


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

    update: function(/*[node, scope,]*/ options){
      options = options || {};
      if(options.nodeType || (options instanceof jQuery)){
        // detect argument signature of (node, scope)
        options = js.extend({
          node: arguments[0],
          scope: arguments[1]
        }, arguments[2] || {});
      }
      var nodeInput = options.node;
      if(options.node instanceof jQuery){
        js.errorIf(options.node.length !== 1, 'you cannot pass a jquery object containing many nodes to react.update()');
        options.node = options.node[0];
      }
      js.errorIf(!options.node, 'you did not pass a valid node to react.update()');

      js.errorIf(options.scope && options.scopes, 'you must supply only one set of scopes');

      var scopes = options.scope ? [options.scope] : options.scopes || [];
      if(options.anchor){
        react.anchor({node: options.node, scopes: scopes});
        scopes = [];
      }

      var operation = new Operation();
      operation.$(options.node).directives[options.fromDirective||'before'].injectScopes('updateInputs', scopes).updateBranch();
      operation.run();
      return nodeInput;
    },

    anchor: function(options){
      options = options || {};
      if(options.nodeType){
        options = {
          node: arguments[0],
          scope: arguments[1]
        };
      }
      var node = options.node;
      var scopes = options.scope ? [options.scope] : options.scopes;

      this.nodes[getNodeKey(node)] = node;
      // todo: clean up any links elsewhere (like listeners) that are left by potential existing anchors
      new Operation().$(node).directives.set('anchored', ['anchored'].concat(js.map(scopes, function(i, scope){
        var scopeKey = getScopeKey(scopes[i]);
        react.scopes[scopeKey] = scopes[i];
        return scopeKey;
      })));
      return options.node;
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

          anchor: function(){
            if(arguments.length){
              return react.update({node:this, scopes:Array.prototype.slice.call(arguments), anchor: true});
            }else{
              var scopes = this.anchors();
              js.errorIf(scopes.length !== 1, '.anchor() can only be called on nodes with a single anchored object');
              return scopes[0];
            }
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

    $: function(node){ return makeNodeWrapper(this, this._$nodes, this._toVisit, this._searched, node);},

    hasRun: function(){ return this._hasRun; },

    isRunning: function(){ return this._isRunning; },

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




  // Overriding jQuery to provide supplemental functionality to DOM node wrappers
  // Within the scope of the Operation constructor, all calls to makeNodeWrapper() return a customized jQuery object. For access to the original, use jQuery()
  var makeNodeWrapper = function(operation, $nodes, toVisit, searched, node){
    js.errorIf(arguments.length !== 5 || !node || node.nodeType !== 1 || js.isArray[node] || node instanceof jQuery, 'the 5th argument to overridden $ must be a DOM node');

    if($nodes[getNodeKey(node)]){ return $nodes[getNodeKey(node)]; }

    var $node = js.create(jQuery(node), {

      node: node,

      key: getNodeKey(node),

      _operation: operation,

      makeDirective: function(index, tokens){ return new Directive($node, index, tokens); },

      getDirectiveStrings: function(){
        return js.map(($node.attr('react')||'').split(matchers.directiveDelimiter), function(which, string){
          return js.trim(string).replace(matchers.negation, '!').replace(matchers.space, ' ');
        });
      },

      getDirectiveArrays: function(){
        return js.reduce($node.getDirectiveStrings(), [], function(which, string, memo){
          return string ? memo.concat([string.split(matchers.space)]) : memo;
        });
      },

      wrappedParent: function(){
        return (
          ! $node.parent()[0] ? null :
          $node.parent()[0] === document ? null :
          operation.$($node.parent()[0])
        );
      },

      store: function(){
        react.nodes[$node.key] = node;
      },

      // note: getReactDescendants() only returns descendant nodes that have a 'react' attribute on them. any other nodes of interest to react (such as item templates that lack a 'react' attr) will not be included
      getReactDescendants: function(){
        return js.map(makeArrayFromArrayLikeObject($node.find('[react]')), function(which, node){
          return operation.$(node);
        });
      },

      getReactNodes: function(){
        return [$node].concat($node.getReactDescendants());
      }

    });

    $node.nullDirective = js.extend($node.makeDirective(null, []), {
      visit: noop,
      isDead: noop,
      shouldUpdate: noop,
      shouldUpdateBranch: noop,
      getScopeChain: function(){ return emptyScopeChain; },
      getParent: function(){ js.error('internal error: cannot get the parent of a null directive'); }
    });

    // build up directives
    var directives = [];
    directives = js.reduce($node.getDirectiveArrays(), directives, function(which, tokens, memo){
      which === 0 && tokens[0] === 'anchored' ?
        memo.anchored = $node.makeDirective('anchored', tokens) :
        memo.push($node.makeDirective((memo.anchored ? which-1 : which).toString(), tokens));
      return memo;
    });

    directives.anchored = directives.anchored || $node.makeDirective('anchored', ['anchored']);

    $node.directives = js.extend(directives,{

      before: $node.makeDirective('before', ['before']),
      after: $node.makeDirective('after', ['after']),

      // todo: this takes an array, rather than a directive object. that seems odd, but directive objects aren't makable outside this scope
      set: function(key, directive){
        directives[key] = $node.makeDirective(''+key, directive);
        directives.write();
      },

      write: function(){
        node.setAttribute('react', directives);
      },

      orderedForString: function(){
        return (directives.anchored.inputs.length ? [directives.anchored] : []).concat(directives);
      },

      toString: function(){
        return js.map(directives.orderedForString(), function(which, directive){
          if(!directive.isDirective && console){ console.log('oops - something\'s wrong with your directives'); }
          return directive.toString();
        }).join(', ');
      },

      prepend: function(directive){
        directive = directive.isDirective ? directive : $node.makeDirective('0', directive);
        directives.unshift(directive);
        js.map(directives, function(which, directive){
          directive.setIndex(which.toString());
        });
        directives.write();
      }

    });

    return ($nodes[$node.key] = $node);
  };




  /*
   * Directive
   */

  // provides an object representing the directive itself (for example, "contain user.name")
  var Directive = function($node, index, tokens){
// todo asdf - every local variable here must be referenced correctly in the methods below
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
      _scopeInjectionArgLists: [],
      _potentialObservers: []
    });

    this.setIndex(index);
  };

  Directive.prototype = js.create(commands);
  Directive.prototype.constructor = Directive;

  js.extend(Directive.prototype, {

    $: function(node){ return this._operation.$(node); },
    isDirective: true,

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

    injectScopes: function(type, scopes){
      this._scopeInjectionArgLists = this._scopeInjectionArgLists.concat(js.map(scopes, function(which, scope){
        return [type, scope];
      }));
      return this;
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
      // todo: fix private access
      return this._operation._toVisit[this.key] = this;
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
        callback.apply(this);
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
          this._runCommand();
        } catch (error) {
          throw this._describeError(error);
        }
      } else {
        this._runCommand();
      }

      if(willUpdate){
        this._registerPotentialObservers();
        if(this.shouldUpdateBranch() && !this._operation._searched[this.$node.key]){ // todo: private var
          this.search();
        }
      }
    },

    _runCommand: function(){
      js.errorIf(!this._operation.isRunning(), 'tried to .visit() a directive outside of operation.run()');
      js.errorIf(!commands[this.command], 'not a valid react command: '+this.command);
      commands[this.command].apply(this, this.inputs);
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
        this._operation._searched[$nodes[which].key] = true; // todo: private var
        $nodes[which].directives.after.consider();
      }
    },

    _getParentInfo: function(){
      if(this._gotParentInfo){ return; }
      this._gotParentInfo = true;
      this._parent = this._parent || this.getParent();
      this._parentIsDead = this.parentIsDead();
      this._shouldUpdateParentBranch = this.shouldUpdateParentBranch();
      this._parentScopeChain = this._parentScopeChain || js.reduce(this._scopeInjectionArgLists, this._parent.getScopeChain(), function(which, scopeChainArguments, memo){
        return memo.extend.apply(memo, scopeChainArguments);
      });
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
        this.index === 'before' ? (this.$node.wrappedParent() ? this.$node.wrappedParent().directives.after : this.$node.nullDirective) :
        this.index === 'anchored' ? this.$node.directives.before :
        this.index.toString() === '0' ? this.$node.directives.anchored :
        this.index.toString().match(matchers.isNumber) ? this.$node.directives[this.index-1] :
        this.index === 'after' ? (this.$node.directives.length ? this.$node.directives[this.$node.directives.length-1] : this.$node.directives.anchored) :
        js.error('invalid directive key')
      );
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

    var observer = {
      object: object,

      directive: operation.$(react.nodes[nodeKey]).directives[directiveIndex],

      key: observerKey,

      write: function(){
        object.observers = object.observers || {};
        object.observers[propertyKey] = object.observers[propertyKey] || {};
        object.observers[propertyKey][observerDetailsString] = true;
      },

      dirty: function(){
        if(observer.isDirty){ return; }
        observer.isDirty = true;
        observer.directive.dirtyObserver(observer);
      },

      pertains: function(){
        // ignore the object if it's not in the same path that lead to registration of the observer
        return observer.directive.getScopeChain().detailedLookup(prefix + propertyKey, {checkFocus: object}).didMatchFocus;
      }
    };

    return (cachedObservers[observerKey] = observer);
  };




  /*
   * commands
   */

  js.extend(react.commands, {

    log: function(){
      var inputs = {}, that = this;
      js.map(arguments, function(which, argument){
        inputs[argument] = that.lookup(argument);
      });
      typeof console !== 'undefined' && console.log('React render state:', {directive:this, scope:this.getScope(), inputs:inputs});
    },

    debug: function(command){
      debugger;
      this[command].apply(this, Array.prototype.slice.call(arguments, 1));
    },

    debugIf: function(condition, command){
      if(this.lookup(condition)){ debugger; }
      this[command].apply(this, Array.prototype.slice.call(arguments, 2));
    },

    before: function(){
      if(this.$node.hasClass('reactItemTemplate')){
        this.dead();
      }
    },

    after: noop,

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

    within: function(key){
      this._withScope('within', key);
    },

    _withScope: function(type, key){
      var scope = this.lookup(key);
      this.onUpdate(function(){
        this.updateBranch();
      });
      scope ? this.pushScope(type, scope, {key:key}) : this.dead();
    },

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

    contain: function(key){
      this.onUpdate(function(){
        // using innerHTML to clear the node because the jQuery convenience functions unbind event handlers. This would be an unexpected side effect for most React user consumption cases.
        this.node.innerHTML = '';
        var insertion = this.lookup(key);
        // if the insertion is a node, use the dom appending method, but insert other items as text
        jQuery(this.node)[insertion && insertion.nodeType ? 'append' : 'text'](insertion);
        // note: .dead() can't happen outside onUpdate() because disabling mutation should only happen when the branch is inserted, not when building an initial scope chain
        this.$node.directives.after.dead();
      });
      this.$node.directives.after.resetScopeChain();
    },

    'if': function(condition){
      var conditional = this.lookup(condition);
      if(!conditional){ this.dead(); }
      this.onUpdate(function(){
        $(this.node)[conditional ? 'removeClass' : 'addClass']('reactConditionallyHidden');
        this._conditionalShow(conditional);
        this.updateBranch();
      });
    },

    _conditionalShow: function(conditional){
      jQuery(this.node)[conditional ? 'show' : 'hide']();
    },

    showIf: function(condition){
      this.onUpdate(function(){
        this._conditionalShow(this.lookup(condition));
      });
    },

    visIf: function(condition){
      this.onUpdate(function(){
        jQuery(this.node).css('visibility', this.lookup(condition) ? 'visible' : 'hidden');
      });
    },

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

        name = this.lookup(name);
        value = this.lookup(value);

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
        this.lookup(condition) ? $(this.node).attr(this.lookup(name), this.lookup(value)) : $(this.node).removeAttr(this.lookup(name));
      });
    },

    checkedIf: function(condition){
      this.onUpdate(function(){
        $(this.node).attr('checked', !!this.lookup(condition));
      });
    }

  });

  /*
   * Exporting library
   */

  window.react = react;

}());
