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

  window.mv = {

    /*
     * when a command runs, it will have a 'this' scope like the following (arrows indicate prototype relationships
     * mv.commands {
     *   command handler definitions
     * }
     *  ^
     *  |
     * mv.commandScope {
     *   lookup(key)
     * }
     *  ^
     *  |
     * updateScope {
     *   _rootNode, _rootScope
     *   scopeChainCache
     * }
     *  ^
     *  |
     * processingScope {
     *   scopeChain
     * }
     */

    commands: {

      within: function(key){
        this.scopeChain.push(this._lookup(key));
      },

      without: function(key){
        this.scopeChain.pop();
      },

      contain: function(key){
        jQuery(this.node).html(this._lookup(key));
      },

      showIf: function(condition){
        jQuery(this.node)[this._lookup(condition) ? 'show' : 'hide']();
      },

      visIf: function(condition){
        jQuery(this.node).css('visibility', this._lookup(condition) ? 'visible' : 'hidden');
      },

      attr: function(name, value){
        name = this._lookup(name);
        value = this._lookup(value);
        js.errorIf(
          !js.among(['string', 'number'], typeof name) ||
          !js.among(['string', 'number'], typeof value),
          'attr names and values must resolve to a string or number'
        );
        jQuery(this.node).attr(name, value);
      },

      attrIf: function(condition, name, value){
        if(this._lookup(condition)){
          this.attr(name, value);
        } else {
          jQuery(this.node).removeAttr(this._lookup(name));
        }
      }

    },

    update: function(root /* , scope1, ..., scopeN */){
      var baseScopeChain = Array.prototype.slice.call(arguments, 1);
      /* todo: add support for strings
      if(typeof scope === 'string'){
        scope = mv.scopes[scope];
      }
      if(typeof root === 'string'){
        root = mv.nodes[root];
      }
      */

      var updateScope = js.create(this.commandScope, {
        _baseScopeChain: baseScopeChain,
        _root: root,
        _scopeChainCache: {},
        _scopeChainCachedNodes: []
      });

      this._process(root, updateScope);

      /* todo: support recursionp
      var nodes = mv.select(node);
      for(var i = 0, length = nodes.length; i< length; i++){
        mv._updateSingle(nodes[i], updateScope);
      }

      // clean up
      js.util.unique.reset('scopeChain');
      for(var i = 0, length = updateScope._scopeChainCachedNodes.length; i< length; i++){
        updateScope._scopeChainCachedNodes[i].scopeChainKey = undefined;
      }
      */
    },

    select: function(node){
      return [node].concat(Array.prototype.slice.call(node.querySelectorAll('[mv]')));
    },

    _matchers: {
      spaceCommaSpace: /\s*,\s*/,
      space: /\s+/,
      isString: /(^'.*'$)|(^".*"$)/,
      negation: /!\s*/,
      isNumber: /\d+/
    },

    _process: function(node, updateScope){
      var directives = node.getAttribute('mv').split(this._matchers.spaceCommaSpace);
      var processingScope = js.create(updateScope, {
        node: node,
        scopeChain: js.copy(updateScope._baseScopeChain)
      });
      for( var i = 0, length = directives.length; i < length; i++ ){
        this._followDirective(processingScope, js.trim(directives[i]).replace(this._matchers.negation, '!').split(this._matchers.space));
      }
    },

    _followDirective: function(scope, directive){
      var command = directive.shift();
      js.errorIf(!this.commands[command], command+' is not a valid mv command');
      this.commands[command].apply(scope, directive);
    }

  };

  mv.commandScope = js.create(mv.commands, {
    _lookup: function(key){
      var negate;
      if(key[0] === '!'){
        negate = true;
        key = key.slice(1);
      }
      if (mv._matchers.isString.test(key)) {
        value = key.slice(1, key.length-1);
      } else {
        var keys = key.split('.');
        var baseKey = keys.shift();
        var value;
        var scopeDepth = this.scopeChain.length - 1;
        while(0 <= scopeDepth){
          value = this.scopeChain[scopeDepth][baseKey];
          if(typeof value === 'function'){
            value = this.scopeChain[scopeDepth][baseKey]();
          };
          if(typeof value !== 'undefined'){
            break;
          }
          scopeDepth--;
        }
        while(keys.length){
          value = value[keys.shift()]
        }
      }
      return negate ? ! value : value;
    }
  });


  mv.integrate = {
    jQuery: function(){
      jQuery.fn.update = function(scope){
        mv.update(this, scope);
      };
    }
  }

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

    _updateNode: function(root, rootScopeChain, $node){
      if($node[0].scopeChainKey){
        return mv._scopeChainCache[$node[0].scopeChainKey];
      }

      var thus = {
        $node: $node,
        lookup: mv._scopeChainLookup,
        scopeChain: js.copy($node[0] === root ? rootScopeChain : mv._updateNode(root, rootScopeChain, mv._getMvAncestor(root, $node)))
      };

      $.each($.trim(($node.attr('mv')||'')).split(','), function(which, directive){
        thus.active = true;
        mv.directive._follow(thus, $.trim(directive).split(/\s+/));
      });
      mv._inScopeChainCache.push($node[0]);
      return mv._scopeChainCache[$node[0].scopeChainKey = js.util.unique('scopeChain')] = thus.scopeChain;
    },

    getNodeKey: function($node){
      $node = $($node);
      js.errorIf($node.length !== 1, 'getNodeKey() cannot operate on arrays multiple nodes');
      var directive, directives = $.trim($node.attr('mv')).split(this.matchers.spaceCommaSpace);
      for(var which = 0; which < directives.length; which++){
        directive = $.trim(directives[which]).split(/\s+/);
        if(directive[0] === 'key'){
          return directive[1];
        }
      };
    },

    setNodeKey: function($node, key){
      $node = $($node);
      js.errorIf($node.length !== 1, 'getNodeKey() cannot operate on arrays multiple nodes');
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
    },

    _getMvAncestor: function(root, $node){
      var $ancestor = $node.parent();
      while($ancestor[0] !== root && ! $ancestor.attr('mv')){
        $ancestor = $ancestor.parent();
      }
      return $ancestor;
    },

    _scopeChainLookup: function(key){
      var type, value;
      for(var i = this.scopeChain.length - 1; 0 <= i; i--){
        // null scopes indicate a shift
        if(this.scopeChain[i] === null){
          return;
        }
        value = this.scopeChain[i][key];
        type = typeof value;
        if(type === 'function'){
          value = value();
          type = typeof value;
          js.errorIf(type === 'undefined', 'mv called a function and got undefined!');
        }
        if(type !== 'undefined'){
          return value;
        }
      }
    },

    directive: {

      prepend: function(directive){
        this._$nodes.each(function(which, node){
          var directives = [directive].concat($.trim($(node).attr('mv')).split(this.matchers.spaceCommaSpace)).join(', ');
          $(node).attr('mv', directives);
        });
      },

      _follow: function(thus, directive){
        if(!directive[0]){
          return;
        }
        js.errorIf(!mv.directive.handlers[directive[0]], directive[0] + ' is not a valid mv command');
        mv.directive.handlers[directive[0]].apply(thus, directive.slice(1));
      },

      handlers: {

        key: js.noop,

        within: function(key){
          var scope = this.lookup(key);
          if(typeof scope === 'undefined'){ return; };
          js.errorIf(typeof scope !== 'object' && typeof scope !== 'array' && typeof scope !== 'function', 'mask commands must receive a namespacing value');
          this.scopeChain.push(scope);
        },

        without: function(){
          js.errorIf(!this.scopeChain.length, 'cannot unmask with no objects on the scope chain!');
          js.errorIf(this.scopeChain[this.scopeChain.length-2] === null, 'cannot unmask from a shift');
          this.scopeChain.pop();
        },

        scope: function(key){
          var scope = this.lookup(key);
          if(typeof scope === 'undefined'){ return; };
          js.errorIf(typeof scope !== 'object' && typeof scope !== 'array' && typeof scope !== 'function', 'shift commands must receive a namespacing value');
          this.scopeChain.concat([null, scope]);
        },

        descope: function(){
          js.errorIf(!this.scopeChain.length, 'cannot unshift with no objects on the scope chain!');
          js.errorIf(this.scopeChain[this.scopeChain.length-2] !== null, 'cannot unshift from a mask');
          this.scopeChain.pop();
          this.scopeChain.pop();
        },

        tether: function(key){
          var scope = mv.scopes[key];
          js.errorIf(typeof scope === 'undefined', 'no scope object found at key '+key);
          if(this.active){
            this.scopeChain.push(scope);
          }
        }

      }

    }

  });

*/

}());
