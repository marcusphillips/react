/*!
 * React for JavaScript - an easy-rerender template language
 * Version 1.2.3, http://github.com/marcusphillips/react
 *
 * Copyright 2010, Marcus Phillips
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function() {

  /*
   * Library-wide helpers
   */

  var noop = function(){};
  var undefined; // safeguard, undefined can be overwritten in the global scope

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
    var ScopeChain = function(type, previousLink, additionalScope, options){
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
          return new ScopeChain(type, scopeChain, additionalScope, options);
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

    // for giving scope objects meaningful names, which appear in the anchor directives on nodes. not yet ready for external consumption
    name: function(name, object){
      js.errorIf(object.reactKey, 'You tried to name a scope object that already had a name');
      object.reactKey = name;
      return this.scopes[name] = object;
    },

    reset: function(){
      this.scopes.length = this.nodes.length = 0;
    },

    // convenience method for setting object values and automatically calling changed on them
    set: function(object, key, value){
      object[key] = value;
      this.changed(object, key);
    },

    // allows user to notify react that an object's property has changed, so the relevant nodes may be updated
    changed: function(){
      new Operation().changed.apply({}, arguments).run();
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
        for(var key in focus){
          if(key !== 'set' && focus[key] && typeof focus[key] === 'object' && !focus[key].set){
            react.helpers(focus[key], deeply);
          }
        }
      }

      return focus;
    },{

      anchor: function(node){
        $(node).anchor(this);
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
        keys = js.isArray(keys) ? keys : [keys];
        for(var i = 0; i < keys.length; i++){
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
            var $ceiling = $(this);
            var $boundChildren = $ceiling.find('[react]').filter(function(which, item){
              var $ancestor = $(item);
              while(($ancestor = $ancestor.parent()).length){
                if($ancestor[0] === $ceiling[0]){ return true; }
                else if($ancestor.is('[react]') || $ancestor.isAnchored()){ return false; }
              }
            });
            return $boundChildren.boundFilter(directiveString);
          },

          boundFilter: function(directiveString){
            if(!directiveString){ return this; }
            var directive = new Directive(directiveString);
            return this.filter(function(item){
              var directives = $(item).boundDirectives();
              for(var i = 0; i < directives.length; i++){
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
    // within an operation, all $node objects are cached to maintain object-identicality across calls to $()
    var $nodes = {};
    var proxies = [];

    // directives we plan to visit, by key
    // to ensure root-first processing order, we earmark each directive we plan to follow, then follow them all during the run() step
    var toVisit = {};
    // visited directives, by key
    var visited = {};
    // branches from which we have already collected all bound descendants
    var searched = {};

    /*
     * Proxy
     */

    // A proxy provides an interface for the observer relationship between any JS object and the nodes/directives observing it's properties

    var Proxy = function(object){

      var proxy = {
        // writes an association between a directive and a property on an object by annotating the object
        observe: function(key, directive, prefix){
          directive.$node.store();
          new Observer(key, directive.$node.key, directive.index, prefix).write();
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
              new Observer(key, keyObserverString).dirty();
            }
          }
        }
      };

      var cachedObservers = {};
      var Observer = function(propertyKey, nodeKey, directiveIndex, prefix){
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
    // Within the scope of the Operation constructor, all calls to $() return a customized jQuery object. For access to the original, use jQuery()
    var $ = function(node){
      js.errorIf(arguments.length !== 1 || !node || node.nodeType !== 1 || js.isArray[arguments[0]] || arguments[0] instanceof jQuery, 'overridden $ can only accept one input, which must be a DOM node');
      if($nodes[getNodeKey(node)]){ return $nodes[getNodeKey(node)]; }

      var $node = js.create(jQuery(node), {
        key: getNodeKey(node),

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
            $($node.parent()[0])
          );
        },

        store: function(){
          react.nodes[$node.key] = node;
        },

        // note: getReactDescendants() only returns descendant nodes that have a 'react' attribute on them. any other nodes of interest to react (such as item templates that lack a 'react' attr) will not be included
        getReactDescendants: function(){
          return js.map(makeArrayFromArrayLikeObject($node.find('[react]')), function(which, node){
            return $(node);
          });
        },

        getReactNodes: function(){
          return [$node].concat($node.getReactDescendants());
        }

      });

      // provides an object representing the directive itself (for example, "contain user.name")
      var Directive = function(index, tokens){
        var isDead;
        var shouldUpdate;
        var shouldUpdateBranch;
        var dirtyObservers = {};
        var scopeChain;
        var scopeInjectionArgLists = [];
        var didCallOnUpdate;
        var potentialObservers = [];
        var directive = js.create(commands, {
          $: $,
          $node: $node,
          node: node,
          isDirective: true,
          command: tokens[0],
          inputs: tokens.slice(1),

          setIndex: function(newIndex){
            index = directive.index = newIndex;
            directive.key = $node.key+' '+index;
          },

          lookup: function(key){
            var details = directive.getScopeChain().detailedLookup(key);
            potentialObservers = potentialObservers.concat(details.potentialObservers);
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
            return scopeChain = scopeChain || directive.getParentScopeChain();
          },

          getParentScopeChain: js.memoizing(function(){
            return js.reduce(scopeInjectionArgLists, directive.getParent().getScopeChain(), function(which, scopeChainArguments, memo){
              return memo.extend.apply(memo, scopeChainArguments);
            });
          }),

          getScope: function(){
            return directive.getScopeChain().scope;
          },

          dirtyObserver: function(observer){
            dirtyObservers[observer.key] = observer;
            return directive.consider();
          },

          dirtyObserverPertains: function(){
            for(var key in dirtyObservers){
              if(dirtyObservers[key].pertains()){ return true; }
            }
          },

          // calling this method ensures that the directive (and all its parents) will be considered for updating in the operation, and considered for a rendering update
          consider: function(){
            return toVisit[directive.key] = directive;
          },

          update: function(){
            shouldUpdate = true;
            return directive.consider();
          },

          updateBranch: function(){
            shouldUpdateBranch = true;
            return directive.update();
          },

          dead: function(){
            isDead = true;
            return directive;
          },

          onUpdate: function(callback){
            didCallOnUpdate = true;
            if(shouldUpdate && callback){
              callback.apply(directive);
            }
            return directive;
          },

          // the directive's command (for example, 'contain') will be executed with a 'this' context of that directive
          visit: js.memoizing(function(){
            directive.getParent().visit();
            var willUpdate = directive.shouldUpdate();
            describeErrors(function(){
              js.errorIf(!isRunning, 'tried to .visit() a directive outside of operation.run()');
              js.errorIf(!commands[directive.command], 'not a valid react command: '+directive.command);
              commands[directive.command].apply(directive, directive.inputs);
              // all directives must run a section of their code in a block passed to this.onUpdate(), even if the block is empty. Put any code that will mutate state there, and leave code that manipulates scope chains, etc outside of it
              js.debugIf(!didCallOnUpdate, 'directives must run this.onUpdate()');
            });
            if(willUpdate){
              for(var i = 0; i < potentialObservers.length; i++){
                var potentialObserver = potentialObservers[i];
                if(potentialObserver.scopeChain.anchorKey){
                  new Proxy(potentialObserver.scopeChain.scope).observe(potentialObserver.key, directive, potentialObserver.scopeChain.prefix);
                }
              }
              if(directive.shouldUpdateBranch() && !searched[directive.$node.key]){
                directive.search();
              }
            }
          }),

          search: function(){
            // when considering updating the after directive of all descendant react nodes, we need to include the root as well, since we might be calling this on another earlier directive of that node
            var $nodes = $node.getReactNodes();
            for(var which = 0; which < $nodes.length; which++){
              // since the querySelectorAll operation finds ALL relevant descendants, we will not need to run it again on any of the children returned by the operation
              searched[$nodes[which].key] = true;
              $nodes[which].directives.after.consider();
            }
          },

          shouldUpdate: function(){
            return !directive.isDead() && (shouldUpdate = shouldUpdate || directive.shouldUpdateParentBranch() || directive.dirtyObserverPertains());
          },

          shouldUpdateBranch: function(){
            return directive.shouldUpdate() && (shouldUpdateBranch || directive.shouldUpdateParentBranch());
          },

          shouldUpdateParentBranch: js.memoizing(function(){
            return directive.getParent().shouldUpdateBranch();
          }),

          isDead: function(){
            return isDead || directive.parentIsDead();
          },

          parentIsDead: js.memoizing(function(){
            directive.getParent().isDead();
          }),

          getParent: js.memoizing(function(){
            var repeatLimit = 10000, parent;
            while(parent !== (parent = directive._potentialParent())){
              parent && parent.visit();
              js.errorIf(!(repeatLimit--), 'Too much parent reassignment'); //You've done something in your directive that makes the parent directive change every time the current parent runs. This is most likely caused by lookups to function properties that mutate the DOM structure
            }
            return parent;
          }),

          _potentialParent: function(){
            return (
              directive.index === 'before' ? ($node.wrappedParent() ? $node.wrappedParent().directives.after : nullDirective) :
              directive.index === 'anchored' ? directives.before :
              directive.index.toString() === '0' ? directives.anchored :
              directive.index.toString().match(matchers.isNumber) ? directives[directive.index-1] :
              directive.index === 'after' ? (directives.length ? directives[directives.length-1] : directives.anchored) :
              js.error('invalid directive key')
            );
          },

          toString: function(){ return [directive.command].concat(directive.inputs).join(' '); }

        });

        directive.setIndex(index);

        var describeErrors = function(callback){
          try{ callback(); } catch (error){
            js.log('Failure during React update: ', {
              'original error': error,
              'original stack': error.stack && error.stack.split ? error.stack.split('\n') : error.stack,
              'while processing node': node,
              'index of failed directive': directive.index,
              'directive call': directive.command+'('+directive.inputs.join(', ')+')'
            }, '(Supplemental dynamic data follows)');
            js.log('Supplemental: ', {
              'scope chain description': directive.getScopeChain().describe(),
              '(internal scope chain object) ': directive.getScopeChain()
            });
            throw error;
          }
        };

        return directive;
      };

      var nullDirective = new Directive(null, [], null);
      nullDirective.visit = nullDirective.shouldUpdate = nullDirective.shouldUpdateBranch = nullDirective.isDead = nullDirective.visit = noop;
      nullDirective.getParent = function(){ js.error('internal error: cannot get the parent of a null directive'); };
      nullDirective.getScopeChain = function(){ return emptyScopeChain; };

      // build up directives
      var directives = js.reduce($node.getDirectiveArrays(), [], function(which, tokens, memo){
        which === 0 && tokens[0] === 'anchored' ?
          memo.anchored = new Directive('anchored', tokens) :
          memo.push(new Directive((memo.anchored ? which-1 : which).toString(), tokens));
        return memo;
      });

      directives.anchored = directives.anchored || new Directive('anchored', ['anchored']);

      $node.directives = js.extend(directives,{

        before: new Directive('before', ['before']),
        after: new Directive('after', ['after']),

        // todo: this takes an array, rather than a directive object. that seems odd, but directive objects aren't makable outside this scope
        set: function(key, directive){
          directives[key] = new Directive(''+key, directive);
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
          directive = directive.isDirective ? directive : new Directive('0', directive);
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

      run: function(){
        js.errorIf(hasRun, 'An operation cannot be run twice');
        isRunning = true;
        // iterating over the toVisit list once isn't sufficient. Since considering a directive might extend the list, and order of elements in a hash is not guarenteed
        js.exhaust(toVisit, function(key, directive){
          js.errorIf(visited[key], 'tried to consider the same directive twice');
          visited[key] = toVisit[key].visit();
        });
        isRunning = false;
        hasRun = true;
     },

      changed: function(object, keys){
        new Proxy(object).changed(keys);
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
      this.onUpdate();
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
      this.onUpdate();
    },

    after: function(){ this.onUpdate(); },

    anchored: function(/*token1, ...tokenN */){
      //this.resetScopeChain();
      for(var i = 0; i < arguments.length; i++){
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
        this.onUpdate().dead();
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

      var itemNodes = [], pregeneratedItemCount = 0, lastPregeneratedItem = $itemTemplate, itemsToRemove = [];
      for(var i = 1; i < $children.length; i++){
        if(this.$($children[i]).hasClass('reactItem')){
          pregeneratedItemCount++;
          collection.length < pregeneratedItemCount ? itemsToRemove.push($children[i]) : (lastPregeneratedItem = $children[i]);
        }
      }
      var newItems = [], newItem;
      for(i = pregeneratedItemCount; i < collection.length; i++){
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
