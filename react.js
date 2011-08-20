/*!
 * React for JavaScript - an easy-rerender template language
 * Version 1.1.2, http://github.com/marcusphillips/react
 *
 * Copyright 2010, Marcus Phillips
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

(function () {

  var doNotRecurse = {};

  var undefined;

  var matchers = {
    directiveDelimiter: /\s*,\s*/,
    space: /\s+/,
    isString: /(^'.*'$)|(^".*"$)/,
    negation: /!\s*/,
    isNumber: /\d+/
  };

  var getNodeKey = function(node){
    // todo: without using .data(), IE copies expando properties over, breaking loop behaviors and other cloning operations. disable .data() long enough to write a test for this.
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

  var Fallthrough = function(key){ this.key = key; };

  var updateNodes = function(nodes, updateContext){
    for(var i = 0; i < nodes.length; i++){
      makeRnode(nodes[i]).update(updateContext);
    }
  };

  // todo: calling Array.prototype.slice.call on the results of a call to .querySelectorAll blows up in IE. revert this code to use that and write a test for it.
  // also see if there's a more efficient way to build an array other than iterating over the array like object
  var makeArrayFromArrayLikeObject = function(arrayLikeObject){
    var array = [];
    for(var i = 0, length = arrayLikeObject.length; i < length ; i++){
      array.push(arrayLikeObject[i]);
    }
    return array;
  };

  var emptyScopeChain = (function(){

    var makeScopeChain = function(type, previousLink, additionalScope, options){
      options = options || {};
      var scopeChain = {
        parent: previousLink,
        scope: additionalScope,
        type: type,
        key: options.key,
        prefix: options.prefix || '',
        anchorKey: type === 'anchor' ? options.key : (previousLink||{}).anchorKey,

        extend: function(type, additionalScope, options){
          return makeScopeChain(type, scopeChain, additionalScope, options);
        },

        contains: function(scope){
          return scopeChain.scope === scope || scopeChain.parent && scopeChain.parent.contains(scope);
        },

        extendMany: function(type, scopes, options){
          scopes = scopes || [];
          var lastLink = scopeChain;
          for(var which = 0; which < scopes.length; which++){
            lastLink = lastLink.extend(type, scopes[which], options);
          }
          return lastLink;
        },

        extendForAnchorNames: function(names){
          names = names || [];
          var scopes = [];
          for(var whichToken = 0; whichToken < names.length; whichToken++){
            var scopeKey = names[whichToken];
            js.errorIf(!react.scopes[scopeKey], 'could not follow anchored directive, nothing found at react.scopes.'+scopeKey);
            scopes.push(react.scopes[scopeKey]);
          }
          return scopeChain.extendMany('anchor', scopes, {key: scopeKey});
        },

        observe: function(key, directive){
          var object = scopeChain.scope;
          // todo: scope observers per node-object anchoring, for easy cleanup of memory references
          react.nodes[directive.rnode.getKey()] = directive.rnode.node;
          var observations = directive.rnode.node['directive ' + directive.index + ' observes'] = directive.rnode.node['directive ' + directive.index + ' observes'] || [];
          observations.push({object: object, key: key});
          object.observers = object.observers || {};
          object.observers[key] = object.observers[key] || {};
          object.observers[key][directive.rnode.getKey() + ' ' + directive.index + ' ' + scopeChain.prefix] = true;
        },

        lookup: function(key, options){
          options = options || {};
          if(key[0] === '!'){
            var negate = true;
            key = key.slice(1);
          }
          if (matchers.isString.test(key)) {
            return key.slice(1, key.length-1);
          }

          // todo: clean up any pre-existing observers

          var path = key.split('.');
          var baseKey = path.shift();
          var details = {failed: true};
          // todo: write a test to verify that responses to change events don't result in new observers
          // todo: test that we don't observe binding objects
          if(scopeChain.scope[baseKey] instanceof Fallthrough){
            details = scopeChain.parent.lookup([scopeChain.scope[baseKey].key].concat(path).join('.'), js.extend({details:true}, options));
          }else if(scopeChain.scope[baseKey] !== undefined){
            if(scopeChain.anchorKey && options.listeningDirective && !options.suppressObservers){
              scopeChain.observe(baseKey, options.listeningDirective);
            }
            var prefix = baseKey + '.';
            var subObject = scopeChain.scope;
            var value = subObject[baseKey];
            while(path.length){ // one for each segment of the dot acess
              subObject = value;
              if(subObject === undefined || subObject === null){
                return options.details ? details : js.error('can\'t find path '+path.join('.')+' on an undefined object');
              }
              if(scopeChain.anchorKey && !options.suppressObservers && options.listeningDirective){
                emptyScopeChain.extend('dotAccess', subObject, {
                  prefix: prefix,
                  anchorKey: scopeChain.anchorKey
                }).observe(path[0], options.listeningDirective);
              }
              prefix = prefix + path[0] + '.';
              value = subObject[path.shift()];
            }
            details = {
              matchingScopeChain: scopeChain,
              matchingBaseObject: subObject,
              baseKey: baseKey,
              negated: negate,
              value: typeof value === 'function' ? value.call(subObject||{}) : value
            };
            details.value = (negate ? ! details.value : details.value);
          }else if(!scopeChain.parent.isEmpty){
            details = scopeChain.parent.lookup(key, js.extend({details:true}, options));
          }
          return options.details ? details : details.value;
        },

        describe: function(){
          var link = scopeChain;
          var scopeChainDescription = [];
          while(link){
            scopeChainDescription.push(['scope: ', link.scope, ', type of scope shift: ' + link.type + (link.key ? ' (key: '+link.key+')': '') + (link.anchorKey ? ', anchored to: '+link.anchorKey+')': '')]);
            link = link.parent;
          }
          return scopeChainDescription;
        }

      };

      return scopeChain;
    };

    var emptyScopeChain = makeScopeChain(undefined, undefined, {type:'empty'});
    emptyScopeChain.isEmpty = true;
    emptyScopeChain.lookup = function(){ js.error('cannot lookup in the empty scope chain'); };
    return emptyScopeChain;
  }());

  var globalScope = {};
  var globalScopeChain = emptyScopeChain.extend('global', globalScope);

  var react = {

    nodes: {},
    scopes: {},

    name: function(name, object){
      this.scopes[name] = object;
    },

    set: function(object, key, value){
      object[key] = value;
      this.changed(object, key);
    },

    changed: function(object, key){
      // if no key is supplied, check every key
      if(arguments.length < 2){
        for(key in object){
          this.changed(object, key);
        }
        // todo: this still won't work for arguments lists
        if(Object.prototype.toString.call(object) === '[object Array]'){
          this.changed(object, 'length');
        }
        return;
      }

      // if there are no observers for the supplied key, do nothing
      if(!object || !object.observers || !object.observers[key]){ return; }

      for(var listenerString in object.observers[key]){
        makeListener(object, key, listenerString).check();
      }
    },

    update: function(/*[node, scope],*/ options){
      options = options || {};
      if(options.nodeType){
        // detect argument signature of (node, scope)
        options = {
          node: arguments[0],
          scope: arguments[1]
        };
        js.extend(options, arguments[2] || {});
      }
      return makeRnode(options.node).updateTree(options);
    },

    _enqueueNodes: function(newNodes){
      this.nodesToUpdate.push.apply(this.nodesToUpdate, newNodes);
      for(var whichNode = 0; whichNode < newNodes.length; whichNode++){
        var nodeKey = getNodeKey(newNodes[whichNode]);
        delete this.bequeathedScopeChains[nodeKey];
        delete this.loopItemTemplates[nodeKey];
      }
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
      makeRnode(node).directives.set('anchored', ['anchored'].concat(js.map(scopes, function(i, scope){
        var scopeKey = getScopeKey(scopes[i]);
        react.scopes[scopeKey] = scopes[i];
        return scopeKey;
      })));
      return options.node;
    },

    integrate: {
      jQuery: function(){
        jQuery.fn.update = function(scope){
          react.update(this, scope);
        };
      }
    }

  };


  var commands = react.commands = js.create(react, {

  /*
   * when a command runs, it will have a 'this' scope like the following (arrows indicate prototype relationships)
   *
   * react {
   * }
   *
   *  ^
   *  |
   * commands {
   *   command handler definitions
   *   lookup(key)
   * }
   *
   *  ^
   *  |
   * // a new processing scope is created for each node to be updated
   * nodeContext {
   *   node
   *   scopeChain
   * }
   */

    lookup: function(key, options){
      options = options || {};
      options.listeningDirective = makeRnode(this.node).directives[this.directiveIndex];
      options.suppressObservers = 'suppressObservers' in options ? options.suppressObservers : this.suppressObservers;

      return this.scopeChain.lookup(key, options);
    },

    anchored: function(token){
      this.pushScope('anchor', this.scopes[token], {key:token});
    },

    within: function(key){
      // todo: port and test this
      // js.errorIf(typeof scope !== 'object' && typeof scope !== 'array' && typeof scope !== 'function', 'mask commands must receive a namespacing value');
      this.pushScope('within', this.lookup(key), {key:key});
    },

    contain: function(key){
      // using innerHTML to clear the node because the jQuery convenience functions unbind event handlers. This would be an unexpected side effect for most React user consumption cases.
      this.node.innerHTML = '';
      var insertion = this.lookup(key);
      // if the insertion is a node, use the dom appending method, but insert other items as text
      if(insertion && insertion.nodeType){
        jQuery(this.node).append(insertion);
        this._enqueueNodes(makeRnode(insertion).getReactNodes());
      } else {
        jQuery(this.node).text(insertion);
      }
    },

    classIf: function(conditionKey, nameKey){
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
    },

    _createItemNodes: function(directiveMaker){
      var $loopChildren = jQuery(this.node).children();
      js.errorIf($loopChildren.length < 2, 'looping nodes must contain at least 2 children - one item template and one results container');
      var $itemTemplate = $loopChildren.first();
      //js.errorIf(makeRnode($itemTemplate[0]).directives[0].join(' ') !== 'itemTemplate', 'the item template must declare itself with an item directive');
      $itemTemplate.addClass('reactItemTemplate');
      this.loopItemTemplates[getNodeKey($itemTemplate[0])] = $itemTemplate[0];
      var $resultsContainer = $($loopChildren[1]);
      var $resultsContents = $resultsContainer.children();

      // todo: ignore binding scopes when looking for scope to iterate over
      var collection = this.scopeChain.scope;
      // todo: don't allow looping over static native objects (like strings - this is almost certainly an error)
      js.errorIf(collection === null || collection === undefined, 'The loop command expected a collection, but instead encountered '+collection);
      if(this.scopeChain.anchorKey && !this.suppressObservers){
        // todo: optimize. this is a shortcut - it simply puts a listener on the length property that results in a complete re-render of the looping directive if ever a change in length is noticed
        this.scopeChain.observe('length', makeRnode(this.node).directives[this.directiveIndex]);
      }

      var itemNodes = [];
      for(var i = 0; i < collection.length; i++){
        var itemNode = $resultsContents[i];
        if(!itemNode){
          itemNode = $itemTemplate.clone().removeClass('reactItemTemplate')[0];
          // todo: implement bindings as key aliases
          js.errorIf(matchers.space.test(i), 'looping not currently supported over colletions with space-filled keys'); // todo: make this even more restrictive - just alphanumerics
          var itemDirective = directiveMaker(i);
          makeRnode(itemNode).directives.prepend(itemDirective);
          this._enqueueNodes(makeRnode(itemNode).getReactNodes());
        }
        itemNodes.push(itemNode);
      }
      if(collection.length !== $resultsContents.length){
        // we set innerHTML here to prevent jQuery fron detaching all event handlers (automatic in an .html() call)
        $resultsContainer[0].innerHTML = '';
        $resultsContainer.html(itemNodes);
      }
    },

    withinEach: function(){
      // todo: return here (and everywhere else) if collection is undefined.  test for this
      this._createItemNodes(function(index){
        return ['withinItem', index];
      });
    },

    withinItem: function(key){
      // todo: add a rule to only allow getting items from last scope (check if key < scope.length?)
      // todo: add a rule to make sure the last scope object is an array
      js.errorIf(this.scopeChain.scope.length-1 < +key, 'Tried to re-render a node for an index the no longer exists');
      // todo: want to raise an error including link to this.scopeChain.scope - write an error helper
      js.errorIf(!this.scopeChain.scope[key], 'Could not find anything at key '+key+' on the scope object');
      // todo: might be a problem that using the within() as a helper will give the scope a type of 'within'
      this.within(key);
    },

    'for': function(keyAlias, valueAlias){
      var aliases = arguments;
      // todo: return here (and everywhere else) if collection is undefined.  test for this
      this._createItemNodes(function(index){
        return ['bindItem', index].concat(Array.prototype.slice.call(aliases));
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
      // todo: don't make this a fallthrough - create an explicit binding to the previous array scope object
      itemBindings[valueAlias] = new Fallthrough(key);

      this.pushScope('bindItem', itemBindings, {key:key});
    },

    _conditionalShow: function(conditional){
      jQuery(this.node)[conditional ? 'show' : 'hide']();
    },

    'if': function(condition){
      var conditional = this.lookup(condition);
      // this is technical debt, but will go away in the refactor. the suppressObservers flag happens to be useful in this case to detect when we are only building a scope chain.  when that happens, we also don't want to have these side effects on the classes either
      if(!this.suppressObservers){
        $(this.node)[conditional ? 'removeClass' : 'addClass']('reactConditionallyHidden');
      }
      if(!conditional){
        this.pushScope('doNotRecurse', doNotRecurse);
      }
      this._conditionalShow(conditional);
    },

    showIf: function(condition){
      var conditional = this.lookup(condition);
      this._conditionalShow(conditional);
    },

    visIf: function(condition){
      jQuery(this.node).css('visibility', this.lookup(condition) ? 'visible' : 'hidden');
    },

    attr: function(name, value){
      js.errorIf(arguments.length !== 2, 'the attr directive requires 2 arguments');

      name = this.lookup(name);
      value = this.lookup(value);

      if(!js.among(['string', 'number'], typeof name)){
        js.log('bad attr name: ', name);
        js.error('expected attr name token ' + name + ' to resolve to a string or number, not ' + typeof name);
      }else if(!js.among(['string', 'number'], typeof value)){
        js.log('bad attr value: ', value);
        js.error('expected attr value token ' + value + ' to resolve to a string or number not, not ' + typeof value);
      }

      jQuery(this.node).attr(name, value);
    },

    attrIf: function(condition, name, value){
      if(this.lookup(condition)){
        $(this.node).attr(this.lookup(name), this.lookup(value));
      } else {
        $(this.node).removeAttr(this.lookup(name));
      }
    },

    checkedIf: function(condition){
      $(this.node).attr('checked', this.lookup(condition));
    }

  });

  // a reactnode (rnode) is a wrapper for dom nodes that provides supplemental functionality
  var makeRnode = function(node){

    var rnode = {

      node: node,

      getKey: function(){
        return getNodeKey(rnode.node);
      },

      // note: getReactNodes() only returns the operative node and nodes that have a 'react' attribute on them. any other nodes of interest to react (such as item templates that lack a 'react' attr) will not be included
      getReactNodes: function(){
        return [node].concat(makeArrayFromArrayLikeObject(node.querySelectorAll('[react]')));
      },

      getParent: function(updateContext){
        var ancestor = $(node).parent()[0];
        var repeatLimit = 1000;
        while(repeatLimit--){
          if(!ancestor || ancestor === document){
            return false;
          } else if (
            ancestor === updateContext.root ||
            ancestor.getAttribute('react') ||
            updateContext.bequeathedScopeChains[getNodeKey(ancestor)] || // todo: what's this cover?
            updateContext.loopItemTemplates[getNodeKey(ancestor)] // todo: I don't think we need this now that it gets a special class attached to it
          ){
            return ancestor;
          }
          ancestor = $(ancestor).parent()[0];
        }
        js.error('rnode.getParent() broke');
      },

      updateGivenScopeChain: function(scopeChain, updateContext, fromDirective){
        var nodeKey = rnode.getKey();
        var directives = makeRnode(node).directives;

        if(directives.anchored){
          scopeChain = scopeChain.extendForAnchorNames(directives.anchored.inputs);
        }

        var pushScope = function(type, scope, options){
          scopeChain = scopeChain.extend(type, scope, options);
        };

        for(var i = fromDirective || 0; i < directives.length; i++){
          var directiveContext = js.create(updateContext, {
            node: rnode.node,
            directiveIndex: i,
            scopeChain: scopeChain,
            pushScope: pushScope
          });
          directives[i].follow(directiveContext);
        }

        return scopeChain;
      },

      update: function(updateContext){
        //todo: test that you never revisit a node
        var nodeKey = getNodeKey(rnode.node);
        if(
          typeof updateContext.bequeathedScopeChains[nodeKey] !== 'undefined' ||
          rnode.node === updateContext.root // this is to prevent an undefined scope chain for the root getting overwritten with false. don't like it.
        ){
          // node has already been visited
          return;
        }

        if(updateContext.loopItemTemplates[getNodeKey(rnode.node)]){ // todo: get rid of all these references to 'loop item templates', use custom class instead
          updateContext.bequeathedScopeChains[nodeKey] = false;
          return;
        }
        var previousParent = 'unmatchable';
        var parent = rnode.getParent(updateContext);
        // if processing the parent leads to this node having a new parent, repeat
        while(parent !== previousParent){
          if(!parent){
            updateContext.bequeathedScopeChains[nodeKey] = false;
            return;
          }
          makeRnode(parent).update(updateContext);
          if(updateContext.bequeathedScopeChains[getNodeKey(parent)] === false){
            updateContext.bequeathedScopeChains[nodeKey] = false;
            return;
          }
          previousParent = parent;
          parent = rnode.getParent(updateContext);
        }

        var scopeChain = updateContext.bequeathedScopeChains[getNodeKey(parent)] || globalScopeChain;
        updateContext.bequeathedScopeChains[nodeKey] = rnode.updateGivenScopeChain(scopeChain, updateContext);
      },

      updateTree: function(options){
        //todo: test these
        //js.errorIf(!root, 'no root supplied to update()');
        //js.errorIf(react.isNode(root), 'first argument supplied to react.update() must be a dom node');
        js.errorIf(options.scope && options.scopes, 'you must supply only one set of scopes');

        var updateContext = js.create(react.commands, {
          root: rnode.node,
          nodesToUpdate: makeArrayFromArrayLikeObject(rnode.node.querySelectorAll('[react]')),
          bequeathedScopeChains: {},
          loopItemTemplates: {}
        });
        var scopes = options.scope ? [options.scope] : options.scopes ? options.scopes : undefined;
        if(options.anchor){
          react.anchor({node: rnode.node, scopes:scopes});
          scopes = [];
        }
        var baseScopeChain = rnode.buildParentScopeChain(options.fromDirective || 0).extendMany('updateInputs', scopes);
        updateContext.bequeathedScopeChains[rnode.getKey()] = rnode.updateGivenScopeChain(baseScopeChain, updateContext, options.fromDirective);

        updateNodes(updateContext.nodesToUpdate, updateContext);

        return rnode.node;
      },

      buildParentScopeChain: function(directiveIndex){
        var ancestors = $(Array.prototype.reverse.apply($(this.node).parents())).add(this.node);
        var scopeBuildingContext = js.create(react.commands, {
          //todo: deprecate the suppressObservers flag
          suppressObservers: true,
          scopeChain: globalScopeChain
        });
        for(var whichAncestor = 0; whichAncestor < ancestors.length; whichAncestor++){
          scopeBuildingContext.node = ancestors[whichAncestor];
          var directives = makeRnode(scopeBuildingContext.node).directives;
          scopeBuildingContext.scopeChain = scopeBuildingContext.scopeChain.extendForAnchorNames(directives.anchored && directives.anchored.inputs);

          var pushScope = function(type, scope, options){
            scopeBuildingContext.scopeChain = scopeBuildingContext.scopeChain.extend(type, scope, options);
          };

          for(var whichDirective = 0; whichDirective < directives.length; whichDirective++){
            if(scopeBuildingContext.node === this.node && (directiveIndex||0) <= whichDirective){ break; }
            if(!scopeBuildingContext.scopeChain){ continue; }
            if(js.among(['within', 'withinEach', 'bindItem'], directives[whichDirective].command)){
              var directiveContext = js.create(scopeBuildingContext, {
                directiveIndex: whichDirective,
                pushScope: pushScope
              });
              directives[whichDirective].follow(directiveContext);
            }
          }
        }
        return scopeBuildingContext.scopeChain;
      }
    };

    var makeDirective = function(index, tokens){

      var directive = {

        isDirective: true,
        rnode: rnode,
        index: index,
        command: tokens[0],
        inputs: tokens.slice(1),

        toString: function(){
          return [directive.command].concat(directive.inputs).join(' ');
        },

        follow: function(context){
          try{
            if(context.scopeChain.scope === doNotRecurse){
              return doNotRecurse;
            }
            js.errorIf(!commands[directive.command], directive.command+' is not a valid react command');
            commands[directive.command].apply(context, directive.inputs);
          }catch (error){
            js.errorIf(typeof context.directiveIndex !== 'number', 'You tried to follow a directive without supplying a directive index in the execution context');
            js.log('Failure during React update: ', {
              'original error': error,
              'original stack': error.stack && error.stack.split ? error.stack.split('\n') : error.stack,
              'while processing node': context.node,
              'index of failed directive': context.directiveIndex,
              'directive call': directive.command+'('+directive.inputs.join(', ')+')',
              'scope chain description': context && context.scopeChain && context.scopeChain.describe(),
              '(internal scope chain object) ': context.scopeChain
            });
            throw error;
          }
        }

      };

      return directive;
    };

    var directiveStrings = (node.getAttribute('react')||'').split(matchers.directiveDelimiter);
    var directiveArrays = js.map(directiveStrings, function(which, string){
      return js.extend(js.trim(string).replace(matchers.negation, '!').split(matchers.space), {rnode: rnode});
    });
    if(directiveArrays[0] && directiveArrays[0][0] === 'anchored'){
      var anchored = makeDirective('anchored', directiveArrays.shift());
    }
    directiveArrays = js.filter(directiveArrays, function(directiveArray){
      return !!directiveArray[0];
    });

    var directives = js.map(directiveArrays, function(which, directive){
      return makeDirective(''+which, directive);
    });

    rnode.directives = js.extend(directives,{

      anchored: anchored,

      // todo: this takes an array, rather than a directive object. that seems odd, but directive objects aren't makable outside this scope
      set: function(key, directive){
        rnode.directives[key] = makeDirective(''+key, directive);
        rnode.directives.write();
      },

      write: function(){
        node.setAttribute('react', rnode.directives);
      },

      toString: function(){
        var directiveStrings = js.map(rnode.directives, function(which, directive){
          if(!directive.isDirective && console){ console.log('oops - something\'s wrong with your directives'); }
          return directive.toString();
        });
        if(rnode.directives.anchored){
          if(!rnode.directives.anchored.isDirective && console){ console.log('oops - something\'s wrong with your directives'); }
          directiveStrings.unshift(rnode.directives.anchored.toString());
        }
        return directiveStrings.join(', ');
      },

      prepend: function(directive){
        rnode.directives.unshift(directive.isDirective ? directive : makeDirective('0', directive));
        js.map(rnode.directives, function(which, directive){
          directive.index = ''+which;
        });
        rnode.directives.write();
      }

    });

    return rnode;
  };

  var makeListener = function(object, key, listenerString){
    var listener = listenerString.split(' ');
    var rnode = makeRnode(react.nodes[listener[0]]);
    var directiveIndex = +listener[1];

    return {
      object: object,
      key: key,
      rnode: rnode,
      node: rnode.node,
      directiveIndex: directiveIndex,
      prefix: listener[2],
      directive: rnode.directives[directiveIndex],
      scopeChain: rnode.buildParentScopeChain(directiveIndex),
      isValid: function(){
        // ignore the object if it's not in the same path that lead to registration of a listener
        var details = this.scopeChain.lookup(this.prefix+this.key, {details: true, suppressObservers: true});
        return details.matchingBaseObject === this.object || details.failed && this.scopeChain.contains(this.object);
      },
      check: function(){
        if(!this.isValid()){ return; }

        // todo: bindItem is needed here but won't work until the registration is made on the array element it's bound to. something like
        js.errorIf(this.directive.command === 'bindItem', 'you need recalculations for bindItem (when the key was an itemAlias), but those aren\'t implemented yet');
        if(js.among(['within', 'withinEach', 'withinItem', 'for', 'if'], this.directive.command)){
          // todo: loopKey probably won't work, and maybe withinEach either
          makeRnode(this.node).updateTree({
            node: this.node,
            fromDirective: this.directiveIndex
          });
          return;
        }

        var nodesToUpdate = [];
        var updateContext = js.create(react.commands, {
          root: this.node, // todo: is this right? root seems meaningless in this case. only added root to the updateNode method so I could allow updating of whole branch at once
          node: this.node,
          nodesToUpdate: nodesToUpdate,
          scopeChain: this.scopeChain,
// todo: this probably needs a pushscope method
// todo: consolidate all these updateContext object creations
// todo: these last two probably don't belong here. they were added to keep .enqueueNodes() from erroring.
          bequeathedScopeChains: {},
          loopItemTemplates: {}
        });
        var directiveContext = js.create(updateContext, {
          directiveIndex: this.directiveIndex,
        });
        this.directive.follow(directiveContext);
        updateNodes(nodesToUpdate, updateContext);
      }
    };
  };

  window.react = react;

}());
