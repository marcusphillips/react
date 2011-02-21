/*!
 * React for JavaScript - an easy-rerender template language
 * Version 0.7, http://github.com/marcusphillips/react
 *
 * Copyright 2010, Marcus Phillips
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */

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
        for(key in object){
          this.changed(object, key);
        }
        return;
      }
      if(object.observers && object.observers[key]){
        for(var whichListener in object.observers[key]){
          var node = this.nodes[whichListener.split(' ')[0]];
          var directiveIndex = +whichListener.split(' ')[1];
          var prefix = whichListener.split(' ')[2];
          var directive = this._getDirectives(node)[directiveIndex];
          var scopeChain = this._buildScopeChainFor(node, directiveIndex);

          if(this._lookupInScopeChain(prefix+key, scopeChain, {returnObject: true}) !== object){
            // this means the object is not found in the same path that lead to registration of a listener
            continue;
          }

          if(js.among(['within', 'loop', 'atKey'], directive[0])){
            // todo: atkey probably won't work, and maybe loop either
            this._updateTree(node, null, {fromDirective: directiveIndex});
            return;
          }

          var directiveContext = js.create(this.commands, {
            node: node,
            scopeChain: scopeChain,
            directiveIndex: directiveIndex
          });
          this._followDirective(directive, directiveContext);
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
            js.errorIf(!that.scopes[scopeKey], 'could not follow anchored directive, nothing found at react.scopes.'+scopeKey);
            lastLink = that._extendScopeChain(lastLink, that.scopes[scopeKey], {type:'anchor', key: scopeKey});
          }
        }
        for(var whichDirective = 0; whichDirective < directives.length; whichDirective++){
          var eachDirective = directives[whichDirective];
          if(eachAncestor === node && directiveIndex <= whichDirective){ break; }
          if(!lastLink){ continue; }
          if(eachDirective[0] === 'within'){
            lastLink = that._extendScopeChain(lastLink, lastLink.scope[eachDirective[1]], {type:'within', key: eachDirective[1]});
          }else if(eachDirective[0] === 'loop'){
            if(eachDirective[1] === 'as'){
              var loopAliases = {
                key: eachDirective.length === 3 ? eachDirective[1] : undefined,
                value: js.last(eachDirective)
              };
            }
          }else if(eachDirective[0] === 'atKey'){
            if(loopAliases){
              var loopItemScope = {};
              if(loopAliases.key){
                loopItemScope[loopAliases.key] = eachDirective[1];
              }
              loopItemScope[loopAliases.value] = new that._Fallthrough(eachDirective[1]);
              lastLink = this._extendScopeChain(lastLink, loopItemScope, {type:'atKey', key:eachDirective[1]});
              delete loopAlias;
            }else{
              lastLink = this._extendScopeChain(lastLink, lastLink.scope[eachDirective[1]]);
            }
          }
        }
      }
      return lastLink;
    },

    _buildScopeChain: function(scopes, options){
      options = options || {};
      var lastLink = options.prefix;
      if(scopes){
        for(var which = 0; which < scopes.length; which++){
          lastLink = this._extendScopeChain(lastLink, scopes[which], options);
        }
      }
      return lastLink;
    },

    _extendScopeChain: function(link, additionalScope, options){
      options = options || {};
      return {
        parent: link,
        scope: additionalScope,
        type: options.type,
        anchorKey: options.type === 'anchor' ? options.key : (link||{}).anchorKey
      };
    },

    update: function(){
      return this._updateTree.apply(this, arguments);
    },

    // todo: add update(object, key) signature, for refreshing only from certain properties
    _updateTree: function(options){
      options = options || {};
      if(options.nodeType){
        options = {
          node: arguments[0],
          scope: arguments[1]
        };
      }

      var root = options.node;

      //todo: test these
      //js.errorIf(!root, 'no root supplied to update()');
      //js.errorIf(this.isNode(root), 'first argument supplied to react.update() must be a dom node');
      js.errorIf(options.scope && options.scopes, 'you must supply only one set of scopes');

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
      var scopes = options.scope ? [options.scope] : options.scopes ? options.scopes : undefined;
      if(options.anchor){
        this.anchor({node: root, scopes:scopes});
        scopes = undefined;
      }
      var baseScopeChain = this._buildScopeChain(scopes, {type: 'renderInputs', prefix: this._buildScopeChainFor(root, options.firstDirective || 0)});
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
        scopeChain = this._extendScopeChain(scopeChain, scope, options);
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

      var nodeKey = this.getNodeKey(node);
      this.nodes[nodeKey] = node;
      var directives = this._getDirectives(node);
      // todo: clean up after any existing anchor
      directives.anchored = ['anchored'];
      for(var i = 0; i < scopes.length; i++){
        var scopeKey = this.getObjectKey(scopes[i]);
        this.scopes[scopeKey] = scopes[i];
        directives.anchored.push(scopeKey);
      }
      this._setDirectives(node, directives);
    },

    _observeScope: function(object, prefix, key, node, directiveIndex, anchorKey, didMatch){
      // todo: scoper observers per node-object anchoring, for easy cleanup of memory references
      var nodeKey = this.getNodeKey(node);
      this.nodes[nodeKey] = node;
      var observations = node['directive ' + directiveIndex + ' observes'] = node['directive ' + directiveIndex + ' observes'] || [];
      observations.push({object: object, key: key, didMatch: didMatch});
      object.observers = object.observers || {};
      object.observers[key] = object.observers[key] || {};
      object.observers[key][nodeKey + ' ' + directiveIndex + ' ' + prefix] = true;
    },

    _disregardScope: function(node, directiveIndex){
      // todo: check this, it might be jank
      var nodeKey = this.getNodeKey(node);
      var observations = node['directive ' + directiveIndex + ' observes'];
      for(var whichObservation = 0; whichObservation <  observations.length; whichObservation++){
        var observation = observations[whichObservation];
        delete observation.object.observers[observation.key][nodeKey + ' ' + directiveIndex];
      }
      delete nodes.observing[directiveIndex];
      if(!js.size(nodes.observing)){
        delete this.nodes[nodeKey];
      }
    },

    _Fallthrough: function(key){
      this.key = key;
    },

    _lookupInScopeChain: function(key, scopeChain, options){
      if(!scopeChain){
        return;
      }
      options = options || {};
      var negate;
      var value;
      if(key[0] === '!'){
        negate = true;
        key = key.slice(1);
      }
      if (this._matchers.isString.test(key)) {
        return key.slice(1, key.length-1);
      }

      // todo: clean up any pre-existing observers

      var keys = key.split('.');
      var baseKey = keys.shift();
      // the search paths list holds a set of namespaces
      do {
        var object = scopeChain.scope;
        value = object[baseKey];
        if(scopeChain.anchorKey && options.listener){
          this._observeScope(object, '', baseKey, options.listener.node, options.listener.directiveIndex, scopeChain.anchorKey, value !== undefined);
        }
        if(value instanceof this._Fallthrough){
          baseKey = value.key;
        }else if(value !== undefined){
          break;
        }
      }while((scopeChain = scopeChain.parent));

      var prefix = baseKey + '.';
      // one for each segment of the dot acess
      while(keys.length){
        object = value;
        if(object === undefined || object === null){
          return options.returnObject ? false : js.error('can\'t find keys '+keys.join('.')+' on an undefined object');
        }
        prefix = prefix + keys[0] + '.';
        value = object[keys.shift()];
        if(scopeChain.anchorKey && !options.returnObject){
          this._observeScope(object, prefix, keys[0], options.listener.node, options.listener.directiveIndex, scopeChain.anchorKey, true);
        }
      }

      if(options.returnObject){
        return object;
      }

      if(typeof value === 'function'){ value = value.call(object); }
      return negate ? ! value : value;
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
   * // a new processing scope is created for each node to be updated
   * nodeContext {
   *   node
   *   scopeChain
   * }
   */

    lookup: function(key, options){
      options = options || {};
      options.listener = {
        node: this.node,
        directiveIndex: this.directiveIndex
      };
      return this._lookupInScopeChain(key, this.scopeChain, options);
    },

    anchored: function(token){
      this.pushScope(this.scopes[token], {type:'anchor', key:token});
    },

    within: function(key){
      // todo: port and test this
      // js.errorIf(typeof scope !== 'object' && typeof scope !== 'array' && typeof scope !== 'function', 'mask commands must receive a namespacing value');
      this.pushScope(this.lookup(key), {type:'within', key:key});
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
        this.pushScope(this.loopItemScopes[this.getNodeKey(this.node)], {type:'atKey', key:key});
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
    },

    checkedIf: function(condition){
      $(this.node).attr('checked', this.lookup(condition));
    }

  });

}());
