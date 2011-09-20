/*!
 * React for JavaScript - an easy-rerender template language
 * Version 1.2, http://github.com/marcusphillips/react
 *
 * Copyright 2010, Marcus Phillips
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function() {

  /*
   * Library-wide helpers
   */

  var debugging = true;

  var noop = function(){};
  var undefined; // safeguard, undefined can be overwritten in the global scope

  var debug = function(){
    if(debugging && console !== undefined && console.warn && console.warn.apply){
      console.warn.apply(console, arguments);
    }
  };

  var matchers = {
    directiveDelimiter: /\s*,\s*/,
    space: /\s+/,
    negation: /!\s*/,
    isString: /(^'.*'$)|(^".*"$)/,
    isNumber: /^\d+$/
  };

  // returns a unique, consistent key for every node
  var getNodeKey = function(node){
    var key = $(node).data("reactKey");
    if(!key){
      key = js.util.unique('reactNode');
      $(node).data("reactKey", key);
    }
    return key;
  };

  var getScopeKey = function(object){
    return (object.reactKey = object.reactKey || js.util.unique('reactObject'));
  };

  var makeArrayFromArrayLikeObject = function(arrayLikeObject){
    var array = [];
    for(var i = 0, length = arrayLikeObject.length; i < length ; i++){
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
    var makeScopeChain = function(type, previousLink, additionalScope, options){
      options = options || {};

      var scopeChain = {
        parent: previousLink,
        scope: additionalScope,
        type: type,
        key: options.key,
        prefix: options.prefix || '',
// asdf this shouldn't need a prefix
        anchorKey: options.anchorKey ? options.anchorKey : type === 'anchor' ? options.key : (previousLink||{}).anchorKey,

        contains: function(scope){
          return scopeChain.scope === scope || (scopeChain.parent && scopeChain.parent.contains(scope));
        },

        extend: function(type, additionalScope, options){
          return makeScopeChain(type, scopeChain, additionalScope, options);
        },

        extendWithMany: function(type, scopes, options){
          scopes = scopes || [];
          var lastLink = scopeChain;
          for(var which = 0; which < scopes.length; which++){
            lastLink = lastLink.extend(type, scopes[which], options);
          }
          return lastLink;
        },

        // provides the value at a given key by looking through the scope chain from this leaf up
        detailedLookup: function(key, options){
          options = options || {};
          key = key.toString();
          if(key[0] === '!'){
            var negate = true;
            key = key.slice(1);
          }
          // the details object will contain all interesting aspects of this lookup
          // potentialObservers will hold the scopeChain/key pairs that may need to be bound for future updates
          var details = {potentialObservers: []};
          // extend details must be called on any return values, since it handles the final step of negation
          var extendDetails = function(moreDetails){
            for(var key in moreDetails||{}){
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
              debug('Could not find '+key+' on a null or undefined object at path '+scopeChain.prefix+baseKey+' from', scopeChain.scope);
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

    var emptyScopeChain = makeScopeChain('empty');
    return emptyScopeChain;
  }());


  /*
   * Library interface
   */

  var react = {

    nodes: {},
    scopes: {},

    setDebugging: function(setting){
      if(setting === undefined){ setting = true; }
      debugging = setting;
    },

    // for giving scope objects meaningful names, which appear in the anchor directives on nodes. not yet ready for external consumption
    name: function(name, object){
      js.errorIf(object.reactKey, 'You tried to name a scope object that already had a name');
      object.reactKey = name;
      this.scopes[name] = object;
    },

    // convenience method for setting object values and automatically calling changed on them
    set: function(object, key, value){
      object[key] = value;
      this.changed(object, key);
    },

    // allows user to notify react that an object's property has changed, so the relevant nodes may be updated
    changed: function(){
      makeOperation().changed.apply({}, arguments).run();
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
        if(options.node.length !== 1){
          js.error('you cannot pass a jquery object containing many nodes to react.update()');
        }
        options.node = options.node[0];
      }
      js.errorIf(!options.node, 'you did not pass a valid node to react.update()');

      js.errorIf(options.scope && options.scopes, 'you must supply only one set of scopes');

      var scopes = options.scope ? [options.scope] : options.scopes || [];
      if(options.anchor){
        react.anchor({node: options.node, scopes: scopes});
        scopes = [];
      }

      var operation = makeOperation();
      operation.$(options.node).directives[options.fromDirective||'before'].injectScopes('updateInputs', scopes).contageous();
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
      makeOperation().$(node).directives.set('anchored', ['anchored'].concat(js.map(scopes, function(i, scope){
        var scopeKey = getScopeKey(scopes[i]);
        react.scopes[scopeKey] = scopes[i];
        return scopeKey;
      })));
      return options.node;
    },

    integrate: {
      jQuery: function(){
        jQuery.fn.anchor = function(scope){
          return react.update(this, scope, {anchor: true});
        };
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

  var makeOperation = function(){
    // within an operation, all $node objects are cached to maintain object-identicality across calls to $()
    var $nodes = {};
    var proxies = [];

    // to ensure root-first processing order, we earmark each directive we plan to follow, then follow them all during the run() step
    var descendantsToConsider = {};
    var directivesToConsider = {};
    var consideredDirectives = {};
    var deferredDirectives = {};
    var encompassedBranches = {};

    /*
     * Proxy
     */

    // A proxy provides an interface for the observer relationship between any JS object and the nodes/directives observing it's properties

    var makeProxy = function(object){

      var proxy = {
        // writes an association between a directive and a property on an object by annotating the object
        observe: function(key, directive, prefix){
          directive.$node.store();
          makeObserver(key, directive.$node.key, directive.index, prefix).write();
        },

        changed: function(keys){
          // if no key is supplied, check every key
          if(!object || !object.observers){ return; }
          keys = (
            js.isArray(keys) ? keys :
            keys !== undefined ? [keys] :
            js.keys(object).concat('length' in object && !object.propertyIsEnumerable('length') ? ['length'] : [])
          );

          // we first need to collect all the observers of the changed keys
          for(var whichKey = 0; whichKey < keys.length; whichKey++){
            var key = keys[whichKey];
            if(!object.observers[key]){ continue; } // if there are no observers for the supplied key, do nothing
            for(var keyObserverString in object.observers[key]){
              makeObserver(key, keyObserverString).dirty();
            }
          }
        }
      };

      var cachedObservers = {};
      var makeObserver = function(propertyKey, nodeKey, directiveIndex, prefix){
        if(arguments.length === 2){
          var tokens = arguments[1].split(matchers.space);
          nodeKey = tokens[0];
          directiveIndex = tokens[1];
          prefix = tokens[2];
        }

        var observerDetailsString = nodeKey+' '+directiveIndex+' '+prefix;
        var observerKey = propertyKey+' '+observerDetailsString;
        if(cachedObservers[observerKey]){ return cachedObservers[observerKey]; }

        var observer = {
          object: object,

          directive: $(react.nodes[nodeKey]).directives[directiveIndex],

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

      proxies.push(proxy);
      return proxy;
    };

    // Overriding jQuery to provide supplemental functionality to DOM node wrappers
    // Within the scope of makeOperation, all calls to $() return a customized jQuery object. For access to the original, use jQuery()
    var $ = function(node){
      js.debugIf(arguments.length !== 1 || !node || node.nodeType !== 1 || js.isArray[arguments[0]] || arguments[0] instanceof jQuery, 'overridden $ can only accept one input, which must be a DOM node');
      if($nodes[getNodeKey(node)]){ return $nodes[getNodeKey(node)]; }

      var $node = js.create(jQuery(node), {
        key: getNodeKey(node),

        getDirectiveStrings: function(){
          return ($node.attr('react')||'').split(matchers.directiveDelimiter);
        },

        getDirectiveArrays: function(){
          return js.reduce($node.getDirectiveStrings(), [], function(which, string, memo){
            return string ? memo.concat([js.trim(string).replace(matchers.negation, '!').split(matchers.space)]) : memo;
          });
        },

        wrappedParent: function(){
          return (
            ! $node.parent()[0] ? null :
            $node.parent()[0] === document ? null :
            $($node.parent()[0])
          );
        },

        store: function(){
          react.nodes[$node.key] = node;
        },

        // note: getReactDescendants() only returns descendant nodes that have a 'react' attribute on them. any other nodes of interest to react (such as item templates that lack a 'react' attr) will not be included
        getReactDescendants: function(){
          return js.map(makeArrayFromArrayLikeObject(node.querySelectorAll('[react]')), function(which, node){
            return $(node);
          });
        },

        getReactNodes: function(){
          return [$node].concat($node.getReactDescendants());
        }

      });

      // provides an object representing the directive itself (for example, "contain user.name")
      var makeDirective = function(index, tokens){
        var parent;
        var dirtyObservers = {};
        var isDirty, isContageous, isDead;
        var gotIsDirty, gotIsContageous, gotIsDead;
        var followed;
        var scopeChain;
        var scopeInjectionArgLists = [];
        var didCallIfDirty;

        var directive = js.create(commands, {
          $: $,
          $node: $node,
          node: node,
          isDirective: true,
          command: tokens[0],
          inputs: tokens.slice(1),
          reasonsToFollow: [],

          setIndex: function(newIndex){
            index = directive.index = newIndex;
            directive.key = $node.key+' '+index;
          },

          lookup: function(key){
            var details = directive.getScopeChain().detailedLookup(key);
            for(var i = 0; i < details.potentialObservers.length; i++){
              var potentialObserver = details.potentialObservers[i];
              if(directive.isDirty() && potentialObserver.scopeChain.anchorKey){
                makeProxy(potentialObserver.scopeChain.scope).observe(potentialObserver.key, directive, potentialObserver.scopeChain.prefix);
              }
            }
            return details.value;
          },

          resetScopeChain: function(){
            scopeChain = emptyScopeChain;
          },

          injectScopes: function(type, scopes){
            scopeInjectionArgLists = scopeInjectionArgLists.concat(js.map(scopes, function(which, scope){
              return [type, scope];
            }));
            return directive;
          },

          pushScope: function(type, scope, options){
            scopeChain = directive.getScopeChain().extend(type, scope, options);
          },

          getScopeChain: function(){
            if(scopeChain){ return scopeChain; }
            scopeChain = js.reduce(scopeInjectionArgLists, directive.getParent().getScopeChain(), function(which, scopeChainArguments, memo){
              return memo.extend.apply(memo, scopeChainArguments);
            });
            scopeChainInjectionArgLists = [];
            return scopeChain;
          },

          getScope: function(){
            return directive.getScopeChain().scope;
          },

          // state starts undefined, and can be set to 'dead' or 'dirty'
          // if it is left in an undefined state, and it does not inherit a dirty state from some ancestor, it is not rendered
          // a directive is 'dirty' if the currently rendered output needs to be updated based on the new inputs
          // when a directive is 'dead', it isn't rendered. 'dead' trumps any inherited state, and is passed on to all descendants
          dirtyObserver: function(observer){
            js.errorIf(isDirty === false, 'tried to add a dirty observer after checking isDirty');
            dirtyObservers[observer.key] = observer;
            directive.consider();
            return directive;
          },

          dirty: function(){
            js.errorIf(isDirty === false, 'tried to set to isDirty twice');
            js.errorIf(gotIsDirty && isDirty !== true, 'tried to set to isDirty after checking');
            directive.consider();
            isDirty = true;
            return directive;
           },

          contageous: function(){
            js.errorIf(isContageous === false, 'tried to set to isContageous twice');
            js.errorIf(gotIsContageous && isContageous !== true, 'tried to set to isContageous after checking');
            directive.dirty();
            directive.considerDescendants();
            isContageous = true;
            return directive;
          },

          dead: function(){
            isDead = true;
            return directive;
          },

          isDirty: function(){
            gotIsDirty = true;
            return (isDirty = directive.isDead() ? false : isDirty || directive.getParent().isContageous() || directive.dirtyObserverPertains());
          },

          isContageous: function(){
            gotIsContageous = true;
            return (isContageous = directive.isDead() ? false : isContageous || directive.getParent().isContageous());
          },

          isDead: function(){
            gotIsDead = true;
            return (isDead = isDead || directive.getParent().isDead());
          },

          dirtyObserverPertains: function(){
            return js.reduce(js.toArray(dirtyObservers), false, function(which, observer, memo){
              return memo || observer.pertains();
            });
          },

          // calling this method ensures that the directive (and all its parents) will be visited in the operation, and considered for a rendering update
          consider: function(reason){
            (directivesToConsider[directive.key] = directive).reasonsToFollow.push(reason || 'force');
            return directive;
          },

          considerDescendants: function(){
            directive.consider();
            return (descendantsToConsider[directive.key] = directive);
          },

          hasReasonToConsider: function(){
            return js.reduce(directive.reasonsToFollow, false, function(which, each, memo){
              return memo || each === 'force' || directive.isAmongAncestors(each);
            });
          },

          isAmongAncestors: function(potentialAncestor){
            return potentialAncestor === directive.getParent() || directive.getParent().isAmongAncestors(potentialAncestor);
          },

          ifDirty: function(callback){
            didCallIfDirty = true;
            if(directive.isDirty() && callback){
              callback.apply(directive);
            }
          },

          // the directive's command (for example, 'contain') will be executed with a 'this' context of that directive
          follow: function(){
            js.errorIf(!isRunning, 'An internal error occurred: someone tried to .follow() a directive outside of operation.run()');
            if(followed){ return; }
            followed = true;
            directive.getParent().follow();
            describeErrors(function(){
              js.errorIf(!commands[directive.command], directive.command+' is not a valid react command');
              commands[directive.command].apply(directive, directive.inputs);
              js.errorIf(!didCallIfDirty, 'all directives must run a section of their code in a block passed to this.ifDirty(), even if the block is empty. Put any code that will mutate state there, and leave code that manipulates scope chains, etc outside of it.'+ directive.command);
              if(descendantsToConsider[directive.key] && !directive.isDead() && !encompassedBranches[directive.$node.key]){
                // visit the after directive of all descendant react nodes (including the root)
                var $nodes = $node.getReactNodes();
                for(var which = 0; which < $nodes.length; which++){
                  encompassedBranches[$nodes[which].key] = true;
                  $nodes[which].directives.after.consider(directive);
                }
              }
            });
          },

          getParent: function(){
            if(parent){ return parent; }
            var getCurrentParent = function(){
              return (
                directive.index === 'before' ? ($node.wrappedParent() ? $node.wrappedParent().directives.after : nullDirective) :
                directive.index === 'anchored' ? directives.before :
                directive.index.toString() === '0' ? directives.anchored :
                directive.index.toString().match(matchers.isNumber) ? directives[directive.index-1] :
                directive.index === 'after' ? (directives.length ? directives[directives.length-1] : directives.anchored) :
                js.error('invalid directive key')
              );
            };
            var repeatLimit = 10000;
            while(parent !== (parent = getCurrentParent())){
              if(parent){ parent.follow(); }
              js.errorIf(!(repeatLimit--), 'You\'ve done something really crazy in your directives. Probably mutated state in a way that changes the dom structure. Don\'t do that.');
            }
            return parent;
          },

          setParent: function(directive){
            parent = directive;
          },

          toString: function(){
            return [directive.command].concat(directive.inputs).join(' ');
          }

        });

        directive.setIndex(index);

        var describeErrors = function(callback){
          try{ callback(); } catch (error){
            js.log('Failure during React update: ', {
              'original error': error,
              'original stack': error.stack && error.stack.split ? error.stack.split('\n') : error.stack,
              'while processing node': node,
              'index of failed directive': directive.index,
              'directive call': directive.command+'('+directive.inputs.join(', ')+')',
              'scope chain description': directive.getScopeChain().describe(),
              '(internal scope chain object) ': directive.getScopeChain()
            });
            throw error;
          }
        };

        return directive;
      };

      var nullDirective = makeDirective(null, [], null);
      nullDirective.follow = noop;
      nullDirective.isDirty = nullDirective.isContageous = nullDirective.isAmongAncestors = nullDirective.isDead = function(){ return false; };
      nullDirective.getParent = function(){ js.error('internal error: cannot get the parent of a null directive'); };
      nullDirective.getScopeChain = function(){ return emptyScopeChain; };

      // build up directives
      var directives = js.reduce($node.getDirectiveArrays(), [], function(which, tokens, memo){
        which === 0 && tokens[0] === 'anchored' ?
          memo.anchored = makeDirective('anchored', tokens) :
          memo.push(makeDirective((memo.anchored ? which-1 : which).toString(), tokens));
        return memo;
      });

      directives.anchored = directives.anchored || makeDirective('anchored', ['anchored']);

      $node.directives = js.extend(directives,{

        before: makeDirective('before', ['before']),
        after: makeDirective('after', ['after']),

        // todo: this takes an array, rather than a directive object. that seems odd, but directive objects aren't makable outside this scope
        set: function(key, directive){
          directives[key] = makeDirective(''+key, directive);
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
          directive = directive.isDirective ? directive : makeDirective('0', directive);
          directives.unshift(directive);
          js.map(directives, function(which, directive){
            directive.setIndex(which.toString());
          });
          directives.write();
        }

      });

      return ($nodes[$node.key] = $node);
    };

    var getDirective = function(key){
      var tokens = key.split(' ');
      return $(key[0]).directives[tokens[1]];
    };

    var hasRun = false, isRunning = false;
    var operation = {
      $: $,

      updateBranch: function(node, fromDirective){
        $(node).directives[fromDirective||'after'].contageous();
      },

      run: function(){
        js.errorIf(hasRun, 'An operation cannot be run twice');
        isRunning = true;
        var repeatLimit = 100000;
        // iterating over the directivesToConsider list once isn't sufficient. Since considering a directive might extend the list, and order of elements in a hash is not guarenteed
        while(js.hasKeys(directivesToConsider)){
          js.errorIf(!(repeatLimit--), 'we seem to be checking quite a few directives here...');
          for(var key in directivesToConsider){
            js.errorIf(consideredDirectives[key], 'internal error: react tried to consider the same directive twice');
            var directive = directivesToConsider[key];
            if( directive.hasReasonToConsider() ){
              directive.follow();
              consideredDirectives[key] = directive;
            } else {
              // if the reasons for considering a directive are no longer valid (IE the ancestry path changed), defer the directive until all valid directives have been processed, so we can try again when the path might have become valid again
              deferredDirectives[key] = directive;
            }
            delete directivesToConsider[key];
          }
          for(key in deferredDirectives){
            if(deferredDirectives[key].hasReasonToConsider()){
              directivesToConsider[key] = deferredDirectives[key];
              delete deferredDirectives[key];
            }
          }
        }
        isRunning = false;
        hasRun = true;
     },

      changed: function(object, keys){
        makeProxy(object).changed(keys);
        return operation;
      }

    };

    return operation;
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
      typeof console !== 'undefined' && console.log('React render state:', {directive:this, scope:this.getScope(), inputs:inputs})
    },

    before: function(){
      if(this.$node.hasClass('reactItemTemplate')){
        this.dead();
      }
      this.ifDirty();
    },

    after: function(){ this.ifDirty(); },

    anchored: function(/*token1, ...tokenN */){
      for(var i = 0; i < arguments.length; i++){
        var token = arguments[i];
        if(this.scopes[token]){
         this.pushScope('anchor', this.scopes[token], {key:token});
        }else{
          this.dead();
          debug('anchored directive failed to find a scope for the key "'+key+'"');
        }
      }
      this.ifDirty(function(){
        this.contageous();
      });
    },

    within: function(key){
      this._withScope('within', key);
    },

    _withScope: function(type, key){
      var scope = this.lookup(key);
      if(!scope){
        this.lookup(key);
      }
      if(scope){
        this.pushScope(type, scope, {key:key});
      }else{
        this.dead();
        debug('within directive failed to find a scope for the key "'+key+'"');
      }
      this.ifDirty(function(){
        this.contageous();
      });
    },

    withinItem: function(key){
      // todo: add a rule to only allow getting items from last scope (check if key < scope.length?)
      // todo: add a rule to make sure the last scope object is an array
      if(!js.isArray(this.getScope()) || this.getScope().length-1 < +key || !this.getScope()[key]){
        this.dead();
      }
      this._withScope('withinItem', key);
    },

    withinEach: function(){
      this._createItemNodes(function(index, itemNode){
        this.$(itemNode).directives.prepend(['withinItem', index]);
      });
      this.ifDirty(function(){
        this.contageous();
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

      this.ifDirty(function(){
        this.contageous();
      });
    },

    'for': function(keyAlias, valueAlias){
      var aliases = Array.prototype.slice.call(arguments);
      this.ifDirty(function(){
        // todo: return here (and everywhere else) if collection is undefined.  test for this
        this._createItemNodes(function(index, itemNode){
          this.$(itemNode).directives.prepend( ['bindItem', index].concat(aliases) );
        });
        this.contageous();
      });
    },

    _createItemNodes: function(callback){
      var $loopChildren = jQuery(this.node).children();
      js.errorIf($loopChildren.length < 2, 'looping nodes must contain at least 2 children - one item template and one results container');
      var $itemTemplate = $loopChildren.first();
      //js.errorIf(this.$($itemTemplate[0]).directives[0].join(' ') !== 'itemTemplate', 'the item template must declare itself with an item directive');
      $itemTemplate.addClass('reactItemTemplate');
      var $resultsContainer = $($loopChildren[1]);
      var $resultsContents = $resultsContainer.children();

      // todo: ignore binding scopes when looking for scope to iterate over
      var collection = this.getScope();
      if(!js.isArray(collection)){
        this.dead();
        debug('no collection found');
        return;
      }
      if(this.getScopeChain().anchorKey){
        this.lookup('length');
      }

      var itemNodes = [];
      for(var i = 0; i < collection.length; i++){
        var itemNode = $resultsContents[i];
        if(!itemNode){
          itemNode = $itemTemplate.clone().removeClass('reactItemTemplate')[0];
          callback.call(this, i, itemNode);
          this.$(itemNode).directives.before.considerDescendants();
        }
        itemNodes.push(itemNode);
      }
      if(collection.length !== $resultsContents.length){
        // we set innerHTML here to prevent jQuery fron detaching all event handlers (automatic in an .html() call)
        $resultsContainer[0].innerHTML = '';
        $resultsContainer.html(itemNodes);
      }
    },

    contain: function(key){
      this.ifDirty(function(){
        // using innerHTML to clear the node because the jQuery convenience functions unbind event handlers. This would be an unexpected side effect for most React user consumption cases.
        this.node.innerHTML = '';
        var insertion = this.lookup(key);
        // if the insertion is a node, use the dom appending method, but insert other items as text
        jQuery(this.node)[insertion && insertion.nodeType ? 'append' : 'text'](insertion);
        // note: .dead() can't happen outside ifDirty() because disabling mutation should only happen when the branch is inserted, not when building an initial scope chain
        this.$node.directives.after.dead();
      });
      this.$node.directives.after.resetScopeChain();
    },

    'if': function(condition){
      var conditional = this.lookup(condition);
      if(!conditional){ this.dead(); }
      this.ifDirty(function(){
        $(this.node)[conditional ? 'removeClass' : 'addClass']('reactConditionallyHidden');
        this._conditionalShow(conditional);
        this.contageous();
      });
    },

    _conditionalShow: function(conditional){
      jQuery(this.node)[conditional ? 'show' : 'hide']();
    },

    showIf: function(condition){
      this.ifDirty(function(){
        this._conditionalShow(this.lookup(condition));
      });
    },

    visIf: function(condition){
      this.ifDirty(function(){
        jQuery(this.node).css('visibility', this.lookup(condition) ? 'visible' : 'hidden');
      });
    },

    classIf: function(conditionKey, nameKey){
      this.ifDirty(function(){
        this.node.classIfs = this.node.classIfs || {};
        var condition = this.lookup(conditionKey);
        var className;
        var persistence = conditionKey + ' ' + nameKey;
        if(condition){
          className = this.lookup(nameKey);
          if(className){
            $(this.node).addClass(className);
            this.node.classIfs[persistence] = className;
          }
        } else {
          className = this.node.classIfs[persistence] || this.lookup(nameKey);
          if(className){
            $(this.node).removeClass(className);
            delete this.node.classIfs[persistence];
          }
        }
      });
    },

    attr: function(name, value){
      js.errorIf(arguments.length !== 2, 'the attr directive requires 2 arguments');
      this.ifDirty(function(){

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
      this.ifDirty(function(){
        this.lookup(condition) ? $(this.node).attr(this.lookup(name), this.lookup(value)) : $(this.node).removeAttr(this.lookup(name));
      });
    },

    checkedIf: function(condition){
      this.ifDirty(function(){
        $(this.node).attr('checked', !!this.lookup(condition));
      });
    }

  });

  /*
   * Exporting library
   */

  window.react = react;

}());
