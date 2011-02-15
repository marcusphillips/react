/*!
 * React for JavaScript - an easy-rerender template language
 * http://github.com/marcusphillips/react
 *
 * Copyright 2010, Marcus Phillips
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */


/*
anon functions holding scope
remove update context?
*/

// todo: add update(object, key) signature, for refreshing only from certain properties
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

    name: function(name, object){
      this.scopes[name] = object;
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

    _buildScopeChainFor: function(node, directiveIndex, options){
      directiveIndex = directiveIndex || 0;
      var lastLink;
      var that = this;
      var ancestors = $(Array.prototype.reverse.apply($(node).parents())).add(node);
      for(var whichAncestor = 0; whichAncestor < ancestors.length; whichAncestor++){
        var eachAncestor = ancestors[whichAncestor];
        var directives = that._getDirectives(eachAncestor);
        if(directives.anchored){
          for(var whichToken = 1; whichToken < directives.anchored.length; whichToken++){
            var scopeKey = directives.anchored[whichToken];
            js.errorIf(!that._matchers.isString.test(scopeKey), 'not sure how, but this anchored directive got effed.  it\'s supposed to be auto-generated...');
            scopeKey = scopeKey.slice(1,scopeKey.length-1);
            js.errorIf(!that.scopes[scopeKey], 'could not follow anchored directive, nothing found at react.scopes.'+scopeKey);
            lastLink = that._addScopeLink(lastLink, that.scopes[scopeKey], {type:'anchor'});
          }
        }
        for(var whichDirective = 0; whichDirective < directives.length; whichDirective++){
          var eachDirective = directives[whichDirective];
          if(eachAncestor !== node || whichDirective < directiveIndex){
            if(eachDirective[0] === 'within'){
              if(!lastLink){ continue; }
              lastLink = that._addScopeLink(lastLink, lastLink.scope[eachDirective[1]]);
            }
            if(eachDirective[0] === 'loop'){
              if(!lastLink){ continue; }
              if(eachDirective[1] === 'as'){
                var loopAliases = {
                  key: eachDirective.length === 3 ? eachDirective[1] : undefined,
                  value: js.last(eachDirective)
                };
              }
            }
            if(eachDirective[0] === 'atKey'){
              if(!lastLink){ continue; }
              if(loopAliases){
                var loopItemScope = {};
                if(loopAliases.key){
                  loopItemScope[loopAliases.key] = eachDirective[1];
                }
                loopItemScope[loopAliases.value] = new that._Fallthrough(eachDirective[1]);
                lastLink = this._addScopeLink(lastLink, loopItemScope);
                delete loopAlias;
              }else{
                lastLink = this._addScopeLink(lastLink, lastLink.scope[eachDirective[1]]);
              }
            }
          }
        }
      }
      return lastLink;
    },

    _buildScopeChain: function(scopes, options){
      options = options || {};
      var lastLink = options.prefix;
      for(var which = 0; which < scopes.length; which++){
        lastLink = this._addScopeLink(lastLink, scopes[which], options);
      }
      return lastLink;
    },

    _addScopeLink: function(link, additionalLink, options){
      options = options || {};
      return {
        parent: link,
        scope: additionalLink,
        type: options.type
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
      var baseScopeChain = this._buildScopeChain([scope] || [options.scope] || options.scopeChain, {type:'renderInputs', prefix:this._buildScopeChainFor(root)});
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
      updateContext.bequeathedScopeChains[nodeKey] = this._updateNodeGivenScopeChain(node, scopeChain, updateContext);
    },

    _updateNodeGivenScopeChain: function(node, scopeChain, updateContext){
      var nodeKey = this.getNodeKey(node);
      var directives = this._getDirectives(node);

      var pushScope = function(scope, options){
        scopeChain = this._addScopeLink(scopeChain, scope, options);
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
      if(directives[0] && directives[0][0] === 'anchored'){
        var anchored = directives.shift();
      }
      directives = js.filter(directives, function(directive){
        return !!directive[0];
      });
      directives.anchored = anchored;
      return directives;
    },

    _setDirectives: function(node, directives){
      var anchored = directives.anchored;
      directives = js.filter(directives, function(directive){
        return !!directive[0];
      });
      directives.anchored = anchored;
      if(directives.anchored){
        directives.unshift(directives.anchored);
      }
      var directiveStrings = js.map(directives, function(which, directive){
        return directive.join(' ');
      });
      node.setAttribute('react', directiveStrings.join(', '));
    },

    _prependDirective: function(node, directive){
      var directives = this._getDirectives(node);
      directives.unshift(directive);
      this._setDirectives(node, directives);
    },

    _followDirective: function(directive, context){
      var command = directive.shift();
      js.errorIf(!this.commands[command], command+' is not a valid react command');
      this.commands[command].apply(context, directive);
    },

    anchor: function(node, object, options){
      var scopeChain = object ? [object] : options.scopeChain;
      var nodeKey = this.getNodeKey(node);
      this.nodes[nodeKey] = node;
      var directives = this._getDirectives(node);
      // todo: clean up after any existing anchor
      directives.anchored = ['anchored'];
      for(var i = 0; i < scopeChain.length; i++){
        var scopeKey = this.getObjectKey(scopeChain[i]);
        this.scopes[scopeKey] = object;
        directives.anchored.push('\''+scopeKey+'\'');
      }
      this._setDirectives(node, directives);
      object.anchors = object.anchors || {};
      object.anchors[nodeKey] = true;
    },

    _Fallthrough: function(key){
      this.key = key;
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

    anchored: function(token){
      js.errorIf(!this._matchers.isString.test(token), 'anchored directive requires a string');
      token = token.slice(1, length-1);
      this.pushScope(this.scopes[token], {type:'anchor'});
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

    loop: function(as, keyAlias, valueAlias){
      if(valueAlias === undefined){
        valueAlias = keyAlias;
        keyAlias = undefined;
      }

      // todo: return here (and everywhere else) if collection is undefined.  test for this

      var $loopChildren = jQuery(this.node).children();
      js.errorIf($loopChildren.length < 2, 'rv looping nodes must contain at least 2 children - one item template and one results container');
      var $itemTemplate = $loopChildren.first();
      //js.errorIf(this._getDirectives($itemTemplate[0])[0].join(' ') !== 'item', 'the item template must declare itself with an item directive');
      this.loopItemTemplates[this.getNodeKey($itemTemplate[0])] = $itemTemplate[0];
      var $resultsContainer = $($loopChildren[1]);
      var $resultsContents = $resultsContainer.children();

      var collection = this.scopeChain.scope;
      var loopItemScope;

      var itemNodes = [];
      var itemNode;
      // todo: support hash collections
      for(var i = 0; i < collection.length; i++){
        // set up a loop item scope to be applied for each item
        if(as){
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
          // todo: implement bindings as key aliases
          js.errorIf(this._matchers.space.test(i), 'looping not currently supported over colletions with space-filled keys');
          this._prependDirective(itemNode, ['atKey', i]);
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

    atKey: function(key){
      if(this.loopItemScopes[this.getNodeKey(this.node)]){
        this.pushScope(this.loopItemScopes[this.getNodeKey(this.node)]);
      }else{
        this.within(key);
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
