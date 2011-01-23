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
    commands: {
      contain: function(key){
        jQuery(this.node).html(this._lookup(key));
      },

      attr: function(name, value){
        jQuery(this.node).attr(this._lookup(name), this._lookup(value));
      },

      attrIf: function(condition, name, value){
        if(this._lookup(condition)){
          this.attr(name, value);
        } else {
          jQuery(this.node).removeAttr(this._lookup(name));
        }
      }
    },

    update: function(root, scope){
      /* todo: add support for strings
      if(typeof scope === 'string'){
        scope = mv.scopes[scope];
      }
      if(typeof root === 'string'){
        root = mv.nodes[root];
      }
      */

      var commandScope = js.create(this.commandScope, {
        _scope: scope,
        _root: root,
        _scopeChainCache: {},
        _scopeChainCachedNodes: []
      });

      this._process(root, commandScope);

      /* todo: support recursionp
      var nodes = mv.select(node);
      for(var i = 0, length = nodes.length; i< length; i++){
        mv._updateSingle(nodes[i], commandScope);
      }

      // clean up
      js.util.unique.reset('scopeChain');
      for(var i = 0, length = commandScope._scopeChainCachedNodes.length; i< length; i++){
        commandScope._scopeChainCachedNodes[i].scopeChainKey = undefined;
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
      negation: /!\s*/
    },

    _process: function(node, commandScope){
      var directives = node.getAttribute('mv').split(this._matchers.spaceCommaSpace);
      var localCommandScope = js.create(commandScope, {
        node: node
      });
      for( var i = 0, length = directives.length; i < length; i++ ){
        this._followDirective(localCommandScope, js.trim(directives[i]).replace(this._matchers.negation, '!').split(this._matchers.space));
      }
    },

    _followDirective: function(commandScope, directive){
      var command = directive.shift();
      js.errorIf(!this.commands[command], command+' is not a valid mv command');
      this.commands[command].apply(commandScope, directive);
    }

  };

  mv.commandScope = js.create(mv.commands, {
    _lookup: function(key){
      var negate;
      if(key[0] === '!'){
        negate = true;
        key = key.slice(1);
      }
      if(mv._matchers.isString.test(key)){
        return key.slice(1, key.length-1);
      }
      return negate ? !this._scope[key] : this._scope[key];
    }
  });



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

    update: function($roots, scope){
      if(typeof scope === 'string'){
        scope = mv.scopes[scope];
      }
      if(typeof $roots === 'string'){
        $roots = $(mv.nodes[$roots]);
      }

      $($roots).each(function(which, root){
        $(root).find('[mv]').each(function(which, node){
          mv._updateNode(root, [scope], $(node));
        });
        mv._scopeChainCache = {};
        $(mv._inScopeChainCache).each(function(which, node){
          node.scopeChainKey = undefined;
        });
        mv._inScopeChainCache = [];
        js.util.unique.reset('scopeChain');
      });
    },

    _scopeChainCache: {},
    _inScopeChainCache: [],

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

        _if: function(flip, key){
          var result, previousActive = this.active, active = this.lookup(key);
          if(typeof active === 'undefined'){ return;};
          js.errorIf(typeof active !== 'boolean', 'If directives must correspond to boolean values args: '+Array.prototype.join.call(arguments, ', '));
          if(flip){
            active = !active;
          }
          this.active = this.active === true && active === true;
          result = mv.directive._follow(this, Array.prototype.slice.call(arguments, 2));
          this.active = previousActive;
          return result;
        },

        'if': function(key){
          return mv.directive.handlers._if.apply(this, [false].concat(Array.prototype.slice.call(arguments)));
        },

        unless: function(){
          return mv.directive.handlers._if.apply(this, [true].concat(Array.prototype.slice.call(arguments)));
        },

        mask: function(key){
          var scope = this.lookup(key);
          if(typeof scope === 'undefined'){ return; };
          js.errorIf(typeof scope !== 'object' && typeof scope !== 'array' && typeof scope !== 'function', 'mask commands must receive a namespacing value');
          this.scopeChain.push(scope);
        },

        unmask: function(){
          js.errorIf(!this.scopeChain.length, 'cannot unmask with no objects on the scope chain!');
          js.errorIf(this.scopeChain[this.scopeChain.length-2] === null, 'cannot unmask from a shift');
          this.scopeChain.pop();
        },

        shift: function(key){
          var scope = this.lookup(key);
          if(typeof scope === 'undefined'){ return; };
          js.errorIf(typeof scope !== 'object' && typeof scope !== 'array' && typeof scope !== 'function', 'shift commands must receive a namespacing value');
          this.scopeChain.concat([null, scope]);
        },

        unshift: function(){
          js.errorIf(!this.scopeChain.length, 'cannot unshift with no objects on the scope chain!');
          js.errorIf(this.scopeChain[this.scopeChain.length-2] !== null, 'cannot unshift from a mask');
          this.scopeChain.pop();
          this.scopeChain.pop();
        },

        // js.todo('fix tether in other places not to be an attribute');
        tether: function(key){
          var scope = mv.scopes[key];
          js.errorIf(typeof scope === 'undefined', 'no scope object found at key '+key);
          if(this.active){
            this.scopeChain.push(scope);
          }
        },

        contain: function(key){
          var contents = this.lookup(key);
          if(typeof contents === 'undefined'){ return; }
          this.$node.html(this.active ? contents : '');
        },

        display: function(){
          this.$node[this.active ? 'show' : 'hide']();
        },

        visible: function(){
          this.$node.css('visibility', this.active ? 'visible' : 'hidden');
        },

        attr: function(name, value){
          name  = name[0]  === "'" || name[0]  === '"' && name[0]  === name[name.length-1]   ? name.slice(1,name.length-1)   : this.lookup(name);
          value = value[0] === "'" || value[0] === '"' && value[0] === value[value.length-1] ? value.slice(1,value.length-1) : this.lookup(value);
          if(typeof name === 'undefined' || typeof value === 'undefined'){ return; }
          js.errorIf(
            (typeof name !== 'string' && typeof name !== 'number') ||
            (typeof value !== 'string' && typeof value !== 'number'),
            'attr requires a string or number for its second argument'
          );
          this.active ? this.$node.attr(name, value) : this.$node.removeAttr(name);
        }

      }

    }

  });

*/

}());

jQuery.fn.update = function(scope){
  mv.update(this, scope);
};
