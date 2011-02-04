/*!
 * Mutable Views for JavaScript - an Easy-rerender templating language
 * http://github.com/marcusphillips/mutable_views
 *
 * Copyright 2010, Marcus Phillips
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */


// todo: add update(object, key) signature, for refreshing only from certain properties
// todo: add set(object, key), for updating an object property and automatically incurring a call to soi.update() for same
// todo: add augment(object), for adding an id and a set method directly to the object

(function () {

  var undefined;

  window.mv = {

    /*
     * when a command runs, it will have a 'this' scope like the following (arrows indicate prototype relationships
     *
     * mv {
     *   lookup(key)
     *   commands {
     *     command handler definitions
     *   }
     * }
     *
     *  ^
     *  |
     * updateScope {
     *   root
     *   baseScopeChain
     *   nodes to be processed
     *   scopeChains
     * }
     *
     *  ^
     *  |
     * processingScope {
     *   node
     *   scopeChain
     * }
     */

    commands: {

      within: function(key){
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

      loop: function(keyAlias, valueAlias, conjunction, collectionKey){
        if(valueAlias === 'in'){
          collectionKey = conjunction;
          conjunction = valueAlias;
          valueAlias = keyAlias;
          keyAlias = undefined;
        }
        var collection = this.lookup(collectionKey);
        // todo: return here (and everywhere else) if collection is undefined.  test for this

        var $loopChildren = jQuery(this.node).children();
/*todo: support and test a missing contents node
        if($loopChildren.length === 1){
          $(this.node).append($('<span></span>'));
          $loopChildren = $(this.node).children();
        }
*/
        js.errorIf($loopChildren.length < 2, 'rv looping nodes must contain at least 2 children - one item template and one results container');
        var $itemTemplate = $loopChildren.first();
        $itemTemplate.show();
        this.loopItemTemplates[this.getNodeKey($itemTemplate[0])] = $itemTemplate[0];
        var $resultsContainer = $($loopChildren[1]);
        var $resultsContents = $resultsContainer.children();

        var itemNodes = [];
        var additionalUpdateNodes = [];
        var itemNode;
        var i;
        var length = collection.length;
        for(i = 0; i < length; i++){
          if($resultsContents[i]){
            itemNode = $resultsContents[i];
          } else {
            itemNode = $itemTemplate.clone()[0];
            additionalUpdateNodes = additionalUpdateNodes.concat(this._select(itemNode));
          }
          itemNodes.push(itemNode);

          // set up a loop item scope to be applied for each item
          var loopItemScope = this.loopItemScopes[this.getNodeKey(itemNode)] = {};

          if(keyAlias !== undefined){
            loopItemScope[keyAlias] = i;
          }

          loopItemScope[valueAlias] = typeof collection[i] !== 'function' ? collection[i] : (function(original){
            return function(){
              return original.apply(collection, arguments);
            };
          }(collection[i]));
        }
        $itemTemplate.hide();
        if(collection.length !== $resultsContents.length){
          $resultsContainer.html(itemNodes);
        }

        // add top level item nodes to the update list if they don't have mv attributes
        this.nodes.push.apply(this.nodes, additionalUpdateNodes);
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

    },

    _matchers: {
      spaceCommaSpace: /\s*,\s*/,
      space: /\s+/,
      isString: /(^'.*'$)|(^".*"$)/,
      negation: /!\s*/,
      isNumber: /\d+/
    },

    _select: function(node){
      return [node].concat(Array.prototype.slice.call(node.querySelectorAll('[mv]')));
    },

    update: function(root /* , scope1, ..., scopeN */){
      var baseScopeChain = Array.prototype.slice.call(arguments, 1);
      /* todo: add support for strings
      if(typeof scope === 'string'){
        scope = this.scopes[scope];
      }
      if(typeof root === 'string'){
        root = this.nodes[root];
      }
      */

      var nodes = this._select(root);
      var updateScope = js.create(this, {
        root: root,
        baseScopeChain: baseScopeChain,
        nodes: nodes,
        scopeChains: {},
        loopItemScopes: {},
        loopItemTemplates: {},
        lookup: this._lookupInScopeChain
      });

      var i;
      for(i = 0; i < nodes.length; i++){
        this._updateSingle(nodes[i], updateScope);
      }

      return root;
    },

    getNodeKey: function(node){
      return (node.key = node.key || js.util.unique('nodeKey'));
    },

    _updateSingle: function(node, updateScope){
      //todo: test that you never revisit a node
      var nodeKey = this.getNodeKey(node);
      if(updateScope.scopeChains[nodeKey]){
        // node has already been visited
        return updateScope.scopeChains[nodeKey];
      }

      var ancestorScopeChain = updateScope.baseScopeChain;
      if(node !== updateScope.root){
        var ancestor = $(node).parent()[0];
        while(
          ancestor && // is defined
          ancestor !== updateScope.root && // is not root
          ! ancestor.getAttribute('mv') && // has no mv directives
          ! updateScope.loopItemScopes[this.getNodeKey(ancestor)] // isnt a loop item
        ){
          ancestor = $(ancestor).parent()[0];
        }
        if(!ancestor){
          // node was irrelevant - not a decendant of the root, ignore it
          return false;
        }
        ancestorScopeChain = this._updateSingle(ancestor, updateScope);
      }
      if(!ancestorScopeChain || updateScope.loopItemTemplates[this.getNodeKey(node)]){
        // node is a loop template or ancestor was irrelevant, so this node is irrelevant
        return false;
      }

      var processingScope = js.create(updateScope, {
        node: node,
        scopeChain: js.copy(ancestorScopeChain)
      });
      if(updateScope.loopItemScopes[nodeKey]){
        processingScope.scopeChain.push(updateScope.loopItemScopes[nodeKey]);
      }
      var directives = (node.getAttribute('mv')||'').split(this._matchers.spaceCommaSpace);
      directives = js.filter(directives, function(directive){
        return !!directive;
      });
      var i;
      for(i = 0, length = directives.length; i < length; i++){
        this._followDirective(processingScope, js.trim(directives[i]).replace(this._matchers.negation, '!').split(this._matchers.space));
      }

      return (updateScope.scopeChains[nodeKey] = processingScope.scopeChain);
    },

    _followDirective: function(scope, directive){
      var command = directive.shift();
      js.errorIf(!this.commands[command], command+' is not a valid mv command');
      this.commands[command].apply(scope, directive);
    },

    _lookupInScopeChain: function(key){
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
    }

/*
    getNodeKey: function(node){
      var directive, directives = $.trim($node.attr('mv')).split(this.matchers.spaceCommaSpace);
      for(var which = 0; which < directives.length; which++){
        directive = $.trim(directives[which]).split(/\s+/);
        if(directive[0] === 'key'){
          return directive[1];
        }
      };
    },

    setNodeKey: function($node, key){
      var directive, directives = $.trim($node.attr('mv')).split(this.matchers.spaceCommaSpace);
      for(var which = 0; which < directives.length; which++){
        directive = $.trim(directives[which]).split(/\s+/);
        if(directive[0] === 'key'){
          directives[which] = 'key '+key;
        }
      };
      $node.attr('mv', directives.join(', '));
    },

    _addNodeKey: function($node, nodeKey){
      return mv.setNodeKey(nodeKey || mv.getNodeNey($node) || js.util.unique('nodeKey'));
    },

    _addScopeKey: function(scope, scopeKey){
      return scope._mvScopeKey = scopeKey || scope._mvScopeKey || js.util.unique('scopeKey');
    }
*/

  };

  mv.integrate = {
    jQuery: function(){
      jQuery.fn.update = function(scope){
        mv.update(this, scope);
      };
    }
  };

/*
  js.merge(mv, {

    scopes: js.create(window),

    nodes: {},

    tether: function($nodes, scope){
      $nodes = $($nodes);
      if(typeof scope === 'string'){
        scope = mv.scopes[scope];
      }
      if(typeof $nodes === 'string'){
        $nodes = $(mv.nodes[$nodes]);
      }

      var scopeKey = mv._addScopeKey(scope),
          tetheredNodeKeys = $.trim((scope.tethers || '')).split(this.matchers.spaceCommaSpace);

      $nodes.each(function(which, node){
        mv.directive.prepend('tether '+scopeKey, node);
        tetheredNodeKeys.push(mv._addNodeKey(node));
      });

      scope.tethers = js.filter(tetheredNodeKeys).sort().join(', ');
    },

    directive: {

      handlers: {

        key: js.noop,

        within: function(key){
          var scope = this.lookup(key);
          if(scope === undefined){ return; };
  // todo: port and test this
          js.errorIf(typeof scope !== 'object' && typeof scope !== 'array' && typeof scope !== 'function', 'mask commands must receive a namespacing value');
          this.scopeChain.push(scope);
        },

        tether: function(key){
          var scope = mv.scopes[key];
          js.errorIf(scope === undefined, 'no scope object found at key '+key);
          if(this.active){
            this.scopeChain.push(scope);
          }
        }

      }

    }

  });

*/

}());
