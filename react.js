/*!
 * React for JavaScript - an Easy-rerender templating language
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
      spaceCommaSpace: /\s*,\s*/,
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
      var reactListeners = object.reactListeners[key];
      if(!reactListeners){
        return;
      }

      for(var which in reactListeners){
        var reactListener = reactListeners[which];
        this.commands[reactListener.command].apply(reactListener.context, reactListener.args);
      }
    },

    update: function(root /* , scope1, ..., scopeN */){
      //todo: test these
      //js.errorIf(!root, 'no root supplied to update()');
      //js.errorIf(this.isNode(root), 'first argument supplied to react.update() must be a dom node');
      var baseScopeChain = Array.prototype.slice.call(arguments, 1);
      /* todo: add support for strings
      if(typeof scope === 'string'){
        scope = this.scopes[scope];
      }
      if(typeof root === 'string'){
        root = this.nodes[root];
      }
      */

      var updateContext = js.create(this.commands, {
        baseScopeChain: baseScopeChain,
        scopeChains: {},
        loopItemScopes: {},
        loopItemTemplates: {}
      });
      updateContext.updateContext = updateContext; // this is unnecessary, can remove after refactor
      this._updateSingle(root, root, updateContext);

      var nodes = root.querySelectorAll('[react]');
      for(var i = 0; i < nodes.length; i++){
        this._updateSingle(root, nodes[i], updateContext);
      }

      return root;
    },

    _updateSingle: function(root, node, updateContext){
      //todo: test that you never revisit a node
      var nodeKey = this.getNodeKey(node);
      if(updateContext.scopeChains[nodeKey]){
        // node has already been visited
        return updateContext.scopeChains[nodeKey];
      }

      var ancestorScopeChain = updateContext.baseScopeChain;
      if(node !== root){
        var ancestor = $(node).parent()[0];
        while(
          ancestor && // is defined
          ancestor !== root &&
          ! ancestor.getAttribute('react') // has no react directives
        ){
          ancestor = $(ancestor).parent()[0];
        }
        if(!ancestor){
          // node was irrelevant - not a decendant of the root, ignore it
          return false;
        }
        ancestorScopeChain = this._updateSingle(root, ancestor, updateContext);
      }
      if(!ancestorScopeChain || updateContext.loopItemTemplates[this.getNodeKey(node)]){
        // node is a loop template or ancestor was irrelevant, so this node is irrelevant
        return false;
      }

      var nodeContext = js.create(updateContext, {
        node: node,
        scopeChain: js.copy(ancestorScopeChain)
      });
      var directives = (node.getAttribute('react')||'').split(this._matchers.spaceCommaSpace);
      directives = js.filter(directives, function(directive){
        return !!directive;
      });
      for(var i = 0; i < directives.length; i++){
        this._followDirective(nodeContext, js.trim(directives[i]).replace(this._matchers.negation, '!').split(this._matchers.space));
      }

      return (updateContext.scopeChains[nodeKey] = nodeContext.scopeChain);
    },

    _followDirective: function(scope, directive){
      var command = directive.shift();
      js.errorIf(!this.commands[command], command+' is not a valid react command');
      this.commands[command].apply(scope, directive);
    },

    anchor: function(node, object){
      var nodeKey = this.getNodeKey(node);
      this.nodes[nodeKey] = node;
      object.reactAnchors = object.reactAnchors || {};
      object.reactAnchors[nodeKey] = true;
    },

    changed: function(object){
      js.errorIf(!object.reactAnchors, 'the input to react.changed() hasn\'t been anchored to anything yet');
      var key;
      for(key in object.reactAnchors){
        this.update(this.nodes[key], object);
      }
    }

/*
    getNodeKey: function(node){
      var directive, directives = $.trim($node.attr('react')).split(this.matchers.spaceCommaSpace);
      for(var which = 0; which < directives.length; which++){
        directive = $.trim(directives[which]).split(/\s+/);
        if(directive[0] === 'key'){
          return directive[1];
        }
      };
    },

    setNodeKey: function($node, key){
      var directive, directives = $.trim($node.attr('react')).split(this.matchers.spaceCommaSpace);
      for(var which = 0; which < directives.length; which++){
        directive = $.trim(directives[which]).split(/\s+/);
        if(directive[0] === 'key'){
          directives[which] = 'key '+key;
        }
      };
      $node.attr('react', directives.join(', '));
    },

    _addNodeKey: function($node, nodeKey){
      return react.setNodeKey(nodeKey || react.getNodeNey($node) || js.util.unique('nodeKey'));
    },

    _addScopeKey: function(scope, scopeKey){
      return scope._reactScopeKey = scopeKey || scope._reactScopeKey || js.util.unique('scopeKey');
    }
*/

  };

  react.integrate = {
    jQuery: function(){
      jQuery.fn.update = function(scope){
        react.update(this, scope);
      };
    }
  };

/*
  js.merge(react, {

    scopes: js.create(window),

    nodes: {},

    tether: function($nodes, scope){
      $nodes = $($nodes);
      if(typeof scope === 'string'){
        scope = react.scopes[scope];
      }
      if(typeof $nodes === 'string'){
        $nodes = $(react.nodes[$nodes]);
      }

      var scopeKey = react._addScopeKey(scope),
          tetheredNodeKeys = $.trim((scope.tethers || '')).split(this.matchers.spaceCommaSpace);

      $nodes.each(function(which, node){
        react.directive.prepend('tether '+scopeKey, node);
        tetheredNodeKeys.push(react._addNodeKey(node));
      });

      scope.tethers = js.filter(tetheredNodeKeys).sort().join(', ');
    },

  });

*/


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
   *   scopeChains
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
      if(key[0] === '!'){
        negate = true;
        key = key.slice(1);
      }
      if (this._matchers.isString.test(key)) {
        value = key.slice(1, key.length-1);
      } else {
        var keys = key.split('.');
        var baseKey = keys.shift();
        var scopeDepth = this.scopeChain.length - 1;
        while(0 <= scopeDepth){
          value = this.scopeChain[scopeDepth][baseKey];
          if(typeof value === 'function'){
            value = this.scopeChain[scopeDepth][baseKey]();
          }
          if(value !== undefined){
            break;
          }
          scopeDepth--;
        }
        while(keys.length){
          value = value[keys.shift()];
        }
      }
      return negate ? ! value : value;
    },

    within: function(key){
      // todo: port and test this
      // js.errorIf(typeof scope !== 'object' && typeof scope !== 'array' && typeof scope !== 'function', 'mask commands must receive a namespacing value');
      this.scopeChain.push(this.lookup(key));
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
      this.loopItemTemplates[this.getNodeKey($itemTemplate[0])] = $itemTemplate[0];
      var $resultsContainer = $($loopChildren[1]);
      var $resultsContents = $resultsContainer.children();

      var collection = js.last(this.scopeChain);
      var loopItemScope;

      var itemNodes = [];
      var itemNode;
      var i;
      var length = collection.length;
      for(i = 0; i < length; i++){
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
          loopItemScope[valueAlias] = typeof collection[i] !== 'function' ? collection[i] : (function(original){
            return function(){
              return original.apply(collection, arguments);
            };
          }(collection[i]));
        }

        if($resultsContents[i]){
          itemNode = $resultsContents[i];
        } else {
          itemNode = $itemTemplate.clone()[0];
        }
        itemNodes.push(itemNode);

        this.update.apply(react, [itemNode].concat(this.scopeChain).concat([loopItemScope]));
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
