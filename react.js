/*!
 * React for JavaScript - an easy-rerender template language
 * http://github.com/marcusphillips/react
 *
 * Copyright 2010, Marcus Phillips
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */


/*
loop updates internally?
make a tree for scope chain
anon functions holding scope
remove update context?
*/

// todo: add update(object, key) signature, for refreshing only from certain properties
// todo: add set(object, key), for updating an object property and automatically incurring a call to soi.update() for same
// todo: add augment(object), for adding an id and a set method directly to the object

(function () {

  var undefined;

  window.react = {

    nodes: {},

    scopes: {},

    _matchers: {
      directiveDelimiter: /\s*,\s*/,
      space: /\s+/,
      isString: /(^'.*'$)|(^".*"$)/,
      negation: /!\s*/,
      isNumber: /\d+/
    },

    getNodeKey: function(node){
      return (node.reactKey = node.reactKey || js.util.unique('reactNode'));
    },

    getObjectKey: function(object){
      return (object.reactKey = object.reactKey || js.util.unique('reactObject'));
    },

    set: function(object, key, value){
      object[key] = value;
      this.changed(object, key);
    },

    changed: function(object, key){
      if(arguments.length < 2){
        for(var key in object){
          this.changed(object, key);
        }
        return;
      }
      if(object.reactListeners && object.reactListeners[key]){
        for(var whichListener in object.reactListeners[key]){
          var listener = object.reactListeners[key][whichListener];
          var directiveContext = js.create(this.commands, {
            node: listener.node,
            scopeChain: this._buildScopeChainFor(listener.node, listener.index),
            directiveIndex: listener.index
          });
          if(directiveContext.scopeChain.scope !== object){
            // this means the object is not found in the same path that lead to registration of a listener
            continue;
          }
          this._followDirective(this._getDirectives(listener.node)[listener.index], directiveContext);
        }
      }
    },

    _buildScopeChainFor: function(node, directiveIndex){
      // todo: to improve automatic memory management, remove the _scopeChainCache cheat
      return node._scopeChainCache[directiveIndex];
    },

    _buildScopeChain: function(scopes){
      var lastLink;
      for(var which = 0; which < scopes.length; which++){
        lastLink = this._addScopeLink(lastLink, scopes[which]);
      }
      return lastLink;
    },

    _addScopeLink: function(link, additionalLink){
      return {
        parent: link,
        scope: additionalLink
      };
    },

    update: function(){
      return this._updateTree.apply(this, arguments);
    },

    _updateTree: function(root, scope, options){
      options = options || {};
      //todo: test these
      //js.errorIf(!root, 'no root supplied to update()');
      //js.errorIf(this.isNode(root), 'first argument supplied to react.update() must be a dom node');
      js.errorIf(scope && options.scope || scope && options.scopeChain || options.scope && options.scopeChain, 'you must supply only one set of scopes');

      var nodes = Array.prototype.slice.apply(root.querySelectorAll('[react]'));
      var updateContext = js.create(this.commands, {
        enqueueNodes: function(newNodes){
          nodes = nodes.concat(newNodes);
          for(var whichNode = 0; whichNode < newNodes.length; whichNode++){
            delete updateContext.bequeathedScopeChains[this.getNodeKey(newNodes[whichNode])];
            delete updateContext.loopItemScopes[this.getNodeKey(newNodes[whichNode])];
            delete updateContext.loopItemTemplates[this.getNodeKey(newNodes[whichNode])];
          }
        },
        bequeathedScopeChains: {},
        loopItemScopes: {},
        loopItemTemplates: {}
      });
      var baseScopeChain = this._buildScopeChain([scope] || [options.scope] || options.scopeChain);
      updateContext.bequeathedScopeChains[this.getNodeKey(root)] = this._updateNodeGivenScopeChain(root, baseScopeChain, updateContext);

      for(var i = 0; i < nodes.length; i++){
        this._updateNode(nodes[i], updateContext);
      }

      return root;
    },

    _getParent: function(node, updateContext){
      var ancestor = $(node).parent()[0];
      var repeatLimit = 1000;
      while(repeatLimit--){
        if(!ancestor || ancestor === document){
          return false;
        } else if (
          ancestor.getAttribute('react') ||
          updateContext.bequeathedScopeChains[this.getNodeKey(ancestor)] ||
          updateContext.loopItemScopes[this.getNodeKey(ancestor)] // todo: change this to inheritedScopeChains
        ){
          return ancestor;
        }
        ancestor = $(ancestor).parent()[0];
      }
      js.error('_getParent() broke');
    },

    _updateNode: function(node, updateContext){
      //todo: test that you never revisit a node
      var nodeKey = this.getNodeKey(node);
      if(updateContext.bequeathedScopeChains[nodeKey]){
        // node has already been visited
        return;
      }

      var previousParent = 'unmatchable';
      var parent = this._getParent(node, updateContext);
      // if processing the parent leads to this node having a new parent, repeat
      while(parent !== previousParent){
        if(
          !parent ||
          updateContext.bequeathedScopeChains[this.getNodeKey(parent)] === false ||
          updateContext.loopItemTemplates[nodeKey] // todo: remove this by adding a completion flag during loop traversal
        ){
          updateContext.bequeathedScopeChains[nodeKey] = false;
          return;
        }
        this._updateNode(parent, updateContext);
        previousParent = parent;
        parent = this._getParent(node, updateContext);
      }

      var scopeChain = updateContext.bequeathedScopeChains[this.getNodeKey(parent)];
      if(updateContext.loopItemScopes[nodeKey]){
        scopeChain = this._addScopeLink(scopeChain, updateContext.loopItemScopes[nodeKey]);
      }
      updateContext.bequeathedScopeChains[nodeKey] = this._updateNodeGivenScopeChain(node, scopeChain, updateContext);
    },

    _updateNodeGivenScopeChain: function(node, scopeChain, updateContext){
      var nodeKey = this.getNodeKey(node);
      var directives = this._getDirectives(node);

      var pushScope = function(scope){
        scopeChain = this._addScopeLink(scopeChain, scope);
      };

      for(var i = 0; i < directives.length; i++){
        this._followDirective(directives[i], js.create(updateContext, {
          node: node,
          directiveIndex: i,
          scopeChain: scopeChain,
          pushScope: pushScope
        }));
      }

      return scopeChain;
    },

    _getDirectives: function(node){
      var directiveStrings = (node.getAttribute('react')||'').split(this._matchers.directiveDelimiter);
      var that = this;
      var directives = js.map(directiveStrings, function(which, string){
        return js.trim(string).replace(that._matchers.negation, '!').split(that._matchers.space);
      });
      return js.filter(directives, function(directive){
        return !!directive[0];
      });
    },

    _followDirective: function(directive, context){
      var command = directive.shift();
      js.errorIf(!this.commands[command], command+' is not a valid react command');
      this.commands[command].apply(context, directive);
    },

    anchor: function(node, object){
      var nodeKey = this.getNodeKey(node);
      this.nodes[nodeKey] = node;
      object.reactAnchors = object.reactAnchors || {};
      object.reactAnchors[nodeKey] = true;
    }

  };

  react.integrate = {
    jQuery: function(){
      jQuery.fn.update = function(scope){
        react.update(this, scope);
      };
    }
  };


  react.commands = js.create(react, {

  /*
   * when a command runs, it will have a 'this' scope like the following (arrows indicate prototype relationships
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
   * // a common updateContext is used for the entire duration of the update routine, covering all nodes
   * updateContext {
   *   root
   *   baseScopeChain
   *   nodes to be processed
   *   bequeathedScopeChains
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

    lookup: function(key){
      var negate;
      var value;
      var nodeKey = this.getNodeKey(this.node);
      if(key[0] === '!'){
        negate = true;
        key = key.slice(1);
      }
      if (this._matchers.isString.test(key)) {
        value = key.slice(1, key.length-1);
      } else {
        var keys = key.split('.');
        var baseKey = keys.shift();
        var scopeChain = this.scopeChain;
        do {
          var object = scopeChain.scope;
          var allListeners = object.reactListeners = object.reactListeners || {};
          var listenersPerKey = allListeners[key] = allListeners[key] || {};
          var listenerId = nodeKey + ' ' + this.directiveIndex;
          var listener = listenersPerKey[listenerId] = listenersPerKey[listenerId] || {
            node: this.node,
            index: this.directiveIndex
          };
          this.node._scopeChainCache = this.node._scopeChainCache || {};
          this.node._scopeChainCache[this.directiveIndex] = this.scopeChain;
          value = object[baseKey];
          if(value instanceof this._Fallthrough){
            baseKey = value.key;
          }else if(value !== undefined){
            break;
          }
          scopeChain = scopeChain.parent;
        } while(scopeChain)

        while(keys.length){
          object = value;
          value = value[keys.shift()];
        }
        if(typeof value === 'function'){
          value = value.call(object);
        }
      }
      return negate ? ! value : value;
    },

    within: function(key){
      // todo: port and test this
      // js.errorIf(typeof scope !== 'object' && typeof scope !== 'array' && typeof scope !== 'function', 'mask commands must receive a namespacing value');
      this.pushScope(this.lookup(key));
    },

    contain: function(key){
      jQuery(this.node).html(this.lookup(key));
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

    _Fallthrough: function(key){
      this.key = key;
    },

    loop: function(as, keyAlias, valueAlias){
      if(valueAlias === undefined){
        valueAlias = keyAlias;
        keyAlias = undefined;
      }

      // todo: return here (and everywhere else) if collection is undefined.  test for this

      var $loopChildren = jQuery(this.node).children();
      js.errorIf($loopChildren.length < 2, 'rv looping nodes must contain at least 2 children - one item template and one results container');
      var $itemTemplate = $loopChildren.first();
      this.loopItemTemplates[this.getNodeKey($itemTemplate[0])] = $itemTemplate[0];
      var $resultsContainer = $($loopChildren[1]);
      var $resultsContents = $resultsContainer.children();

      var collection = this.scopeChain.scope;
      var loopItemScope;

      var itemNodes = [];
      var itemNode;
      for(var i = 0; i < collection.length; i++){
        // set up a loop item scope to be applied for each item
        if(!as){
          // each item in the collection will be the new scope for it's correlative node
          loopItemScope = collection[i];
          js.errorIf(!js.among(['function', 'object'], typeof loopItemScope), 'looping without an "as" directive requires that each element of the collection be an object');
        } else {
          // a new scope will be created with bindings for valueAlias and optionally for keyAlias
          loopItemScope = {};
          if(keyAlias !== undefined){
            loopItemScope[keyAlias] = i;
          }
          loopItemScope[valueAlias] = new this._Fallthrough(i);
        }

        if($resultsContents[i]){
          itemNode = $resultsContents[i];
        } else {
          itemNode = $itemTemplate.clone()[0];
          this.enqueueNodes([itemNode].concat(Array.prototype.slice.apply(itemNode.querySelectorAll('[react]'))));
        }
        this.loopItemScopes[this.getNodeKey(itemNode)] = loopItemScope;
        itemNodes.push(itemNode);

      }
      $itemTemplate.hide();
      if(collection.length !== $resultsContents.length){
        $resultsContainer.html(itemNodes);
      }
    },

    showIf: function(condition){
      jQuery(this.node)[this.lookup(condition) ? 'show' : 'hide']();
    },

    visIf: function(condition){
      jQuery(this.node).css('visibility', this.lookup(condition) ? 'visible' : 'hidden');
    },

    attr: function(name, value){
      name = this.lookup(name);
      value = this.lookup(value);
      js.errorIf(
        !js.among(['string', 'number'], typeof name) ||
        !js.among(['string', 'number'], typeof value),
        'attr names and values must resolve to a string or number'
      );
      jQuery(this.node).attr(name, value);
    },

    attrIf: function(condition, name, value){
      if(this.lookup(condition)){
        $(this.node).attr(this.lookup(name), this.lookup(value));
      } else {
        $(this.node).removeAttr(this.lookup(name));
      }
    }

  });

}());
