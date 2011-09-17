# React templating library

***

## What is React?
React is an HTML templating language designed for easy rerenders.  Rerenders can be triggered automatically when the original input objects change, or they can be managed manually.

***

## What does it look like?
React templates are expressed entirely in HTML, and can always be validated as such.  The directives that control rendering are written out in a custom `react` attribute, such as `<div react="contain myString"></div>`.

***

## Quick, show me something cool

OK, here's some sample code that illustrates the basics:

#### The old way

    <script>
      // this is all the stuff you won't have to do anymore

      var updateProfileDiv = function(userInfo){
        var profileDiv = $('#profile');
    
        profileDiv.find('.mugshot img').attr('src', user.mugshotUrl);
    
        profileDiv.find('.mugshot .caption').html(user.mugshotCaption);
    
        if(userInfo.isAdmin){
          profileDiv.find('.admin_links').show();
        } else {
          profileDiv.find('.admin_links').hide();
        }
      };
    
      // later...
      updateProfileDiv(user);
    </script>


#### The Reactive way

    <script>
      // just once, you anchor a node to its scope
      react.update({
        node: $('#profile')[0],
        scope: user,
        anchor: true
      );
    </script>


#### how is that possible?

It's all due to react directives you put in custom HTML attributes in your templates, like this:

    <div id="profile">
      <img class="mugshot" react="attr 'src' mugshotUrl"/>
      <span class="caption" react="contain mugshotCaption"></span>
      <a href="/admin_panel" react="showIf isAdmin"/>
    </div>

***

## What features does React give me?

#### The output of a rendering operation is still a valid input template
In fact, the output template is equivalent to the the input template, but with appropriate substitutions.  In the process, It retains all its original directives that were used to control rendering.  Directives are things like 'for' and 'contain' that tell the engine what to do to the template - in some template languages, these are expressed with a custom syntax like `{{...}}` or `<?...?>`.  But since React directives are all contained in custom DOM attributes, they can be preserved between render updates.

#### React can manage those view updates for you
Thanks to the previous feature, the library is also capable of managing all view updates, without you manually calling for them.  If you use this auto-rerender feature (or 'anchor'), you can delete large swaths of your view code that were previously responsible for keeping DOM output in sync with model state.  For example, that would include most jQuery operations, such as `$('#mySelector').css({color:'red'}).show()`.

#### React helps your app gracefully scale through complexity
Often in small applications, view management code is minimal enough to go unnoticed.  But as the app grows complex, view management becomes exponentially harder, since each subsequent feature has to be respectful of more and more existing features.  After all, they share a common DOM tree, and each one can impose new expectations on it.  A handshake problem develops as the growing number of features mutate this single resource (see [exponential complexity and the handshake problem](http://en.wikipedia.org/wiki/Triangular_number)).  In essence, while object orientation allows us to divide and conquer app logic, this single, shared view resource (the DOM) mixes it all together again.  Reactive data binding can resolve that.

#### Plays nice with others
What set's React apart from other reactive data binding libraries is its emphasis on compatibility and minimal imposition.  It is compatible with nearly every other JavaScript library and pattern you might be using.

#### Standard building blocks
When rendering templates, React accepts any vanilla JavaScript object, not just a custom class or special data format.  Similarly, the input template can be any valid string of HTML or a memory reference to an existing node.  The output will always be a DOM node reference, but with appropriate substitutions.  (A string output mode is planned for later versions, primarily for use on the server-side.)

#### Intrinsic XSS protection
Since React achieves template substitutions by way of a builder pattern, the browser can always correctly escape your input for the given context.  This is an inherent advantage to builder patterns in general.  Injection attacks occur when an attacker can define part of a string that will eventually be interpreted by some part of the system as if it were code.  With builder patterns, the line between code and input is clear unless you work to blur it, rather than the other way around.  Note that React can't prevent all XSS vulnerabilities in your app, but does make the problem much easier to solve.

#### Any valid HTML snippet is a valid React template, and vice-versa
React doesn't require anything special in your HTML except when you want to tell it what to do at render time, and it never requires non-validating syntax.  Since react directives are stored in an unobtrusive custom attribute, they are ignored by all other parts of the browser and your application.

#### Any JavaScript object is a valid view object
You indicate your substitution values for the update() method by passing it a view object.  To handle this, you can define a class, construct a custom input object every time, or even re-use the JS objects already in use by your system.

#### Renders respect untracked DOM state
Unless you specify otherwise in the directives, React won't replace any part of the DOM tree, or even modify it.  Many client-side template systems achieve data binding by replacing branches of the tree with freshly-rendered ones every time a change event occurs.  This has several undesirable implications:

- Any user interactions that the browser tracks over time (scroll position, cursor highlighting, checked state, etc) get blasted on re-render.  You are usually forced to manage more and more of those details over time, as they become important to your app.
- Any modifications you or your helper libraries have made to the DOM tree (think `$('#mySelector').css({color:'red'})`) get inadvertently discarded at render time if you haven't mirrored those changes to the rendering system.
- Event handlers must be continuously re-bound to the newly rendered nodes.  This is a major source of incompatibility for data binding libraries.  Best case, detaching and re-attaching the listeners is slow but achievable.  Worst case, proper event rebinding is unachievable without major hacks to one of the two conflicting libraries.

By re-using the existing output tree as the template in subsequent renders, React respects these subtle UI modifications.

#### The template structure and directives are readable in your browser's DOM inspector.
React doesn't obscure its directives in the output, so looking at the rendered output with Firebug reveals the same structures you defined in your template file, plus appropriate substitutions.  This parity reduces guesswork about which DOM nodes correspond to which parts of your template code.

#### Dynamic template modification
Manipulating React templates is easy because you don't 'define' them so much as 'provide' them - any node will do.  They're just trees, so you can construct and modify them using all the standard manipulation features provided by the browser (appendChild, innerHTML, etc.), even after render.  For example, if you move part of a rendered React template from one widget to another, you have just successfully modified both templates.  A subsequent update operation on either one will behave as if it's always had the new structure.  This is particularly useful if you already have library or application logic that modifies the DOM dynamically.  That existing code remains valid, with React's features simply stacking on top in predictable ways.

#### Low help:magic ratio
React aims to minimize unpredictable behavior whenever possible.  For example, React won't generate new markup for you. You supply all the control nodes, so there aren't any surprising side-effects on CSS and layout.  At every juncture, React emphasizes explicitness over magic.

#### Encourages valid output markup
Since tags themselves are used to delimit directive blocks, there's no risk of misusing template constructs in combination with HTML constructs (for example, closing a tag inside a conditional).  Formatting errors in your templates can be detected with standard static analysis tools for validating HTML.

***

## What do I give up for these features?
You do make compromises when you choose to express your templates entirely in HTML.  For one thing, it's more verbose for some use cases.  A mid-paragraph variable substitution, for example, will require an entire tag, rather than just a few curly braces.  Furthermore, since the directives are contained in custom attributes, expressing substitutions for attributes themselves can be tricky.  This is why React has special-case directives like 'attr', 'class', and 'style', as well as the conditional versions of each.

***

## How does React compare to other data binding libraries?
Some projects you might like to investigate are [knockout](http://knockoutjs.com/), [jstemplate](http://code.google.com/p/google-jstemplate/), [angular](http://angularjs.org/), which are all fantastic, mature projects.  Usually, the main difference between React and these options is the broader expectations they are willing to make on their execution environment - usually resulting in tighter control for the library writer, and less control for the end developer. For example:

- Some are coupled with other components of their own system (such as a custom 'binding' class for each reactive substitution)
- Some lack features features (like dynamic template modification), that are necessary for compatibility with other common use patterns.
- Some rely on a shared global scope for all templates
- Most don't allow re-use of existing JS objects from your system as view inputs
- Most of them are 'too powerful for their own good' - template languages tend to benefit from being as dumb as possible.  If, for example, the language allows inlining of arbitrary JavaScript code, and then runs eval() on it, it's likely doing more than it should.

There's also data binding support in both [SproutCore](http://www.sproutcore.com/) and [Ext js](http://www.sencha.com/products/extjs/), but you can't currently use those modules independently, since both are tightly coupled with the rest of their respective application architecture, assumptions, and constraints.  If you know of a project I've forgotten, please let me know!

***

## Who should use React?
If you're writing a widget that has or will grow to have non-trivial DOM output, you'll get a lot of value from any library that supports reactive data bindings.  In particular, React is a good choice if you need minimal design impositions and wide compatibility with other client-side libraries.  This is likely to be true when you are introducing reactive bindings to an existing code base little-by-little.

***

## Who shouldn't use React?
Anyone who dislikes loose coupling, laughter, or puppies.  Also, those who need templates that can be rendered by multiple different scripting languages.  For such cases, you might prefer something like [Mustache](http://github.com/janl/mustache.js), by which much of React was inspired.

Another thing React doesn't handle for you (yet) is animations.  If the state of your model changes, and visualizing that change requires an animated transition, you have to handle it yourself, the old-fashioned way.  What a drag!

React doesn't support a two-way binding. For exaple, values the user typs into input fields don't get automatically propogated anywhere. This limitation is purposeful, since it's not dead obvious how such a feature should behave.  If it should become clear what the expected result would be though, I'll add support for it.

Lastly, React is still a young library, so there are sure to be bugs lurking in dark places.  The priority for this library is delivering consistently on existing interface promises, so you can expect bug fixes to come out before feature additions, but check out the todo readme and inline todos for a glipse of the road map for React.

***

### Known Issues ###
- Operations that change list size (like slice) do not automatically add or remove output nodes. You still have to call .changed() on the length property of the array.

***

## What are React's dependencies?
React currently uses jQuery to facilitate DOM operations, though the dependency is not necessary long term.  It also uses some language primitive features from the js.js library.

***

## What are the syntax rules?

- Directives start with the name of a React method, followed by space-delimited arguments to the method
- Arguments can be strings (surrounded with quotes) or keys for making lookups in the scope chain. (Scope chains are explained below, in the list of directives).
- Key arguments result in lookups from the scope chain.  If lookup for a supplied key fails on the topmost scope, it falls through to the next highest scope in the chain, and so on until it succeeds or exhausts the chain.
- Keys support dot notation (`key.subKey`) for selecting a nested property.
- Multiple, comma-delimited directives can be provided in a single `react` attribute.  They will be processed sequentially left-to-right.

***

## What are all the React directives?

### Basics

#### `contain(<string/number/DOM> value)`
Inserts `value` as the contents of the node. Value can be a string, number, or DOM node. (note: contained DOM nodes will not be recursed upon in update operations)

#### `within(<string> key)`
Takes the value found at `key` in the scope chain, and adds it to the top of the scope chain.  Useful for subtemplates, and when dealing with many different properties of a single, nested object.  The behavior is identical to that of Mustache's dereferencing feature.

### Conditionals

In react, conditionals are achieved purely by way of hiding the nodes through css styling.  This way, we don't have to discard the template data, and can easily redisplay it when the input condition changes.

#### `displayIf(<bool> condition)`:
Sets the CSS property `display` to `none` if `condition` is false, and back to the default if it is true

#### `visIf(<bool> condition)`:
Sets the CSS property `visibility` to `hidden` if `condition` is false, and back to default if it is true

### Looping

Looping nodes interpret their first two child nodes in a special way.  The first child is considered an item template.  This will be used as a model to clone each item from.  The second node is considered a results container.  All the clones will be placed into this node.

Generated item nodes are subsequently evaluated, inheriting their scope chain from the loop node, except each one is extended with it's item-specific bindings or scope change added to the end of the chain.

Note: always place loop directives at the very end of your react attribute

Note: Loops assumes the top-most scope object is an array.

Note: To improve speed and consistency, item nodes are not regenerated on subsequent calls to `update()`.  The `loop()` method will just assume that any node it finds in the results container node was generated by the loop, and will attempt to re-use it.

#### `for([<string> indexAlias,] <*> valueAlias)`
This is a looping construct that provides a different variable binding for each iteration.  Both types of loops (this one and `withinEach()`) have the effect of creating a node for each element of the list they traverse.  In this version, no new scope is pushed onto the chain, but a binding is created to the current item (and optionally, to the current index), based on your arguments.

#### `withinEach()`
Loops over the top-most object in the scope chain, generating a new node for each property.  The new nodes inherit scope as normal, but each one gets an its respective item object pushed onto its local scope.  In some sense, withinEach can be said to imply a new 'within' directive at the beginning of each item node.

### Tag-internal directives

Some things you wish to express in your template will relate directly to tag attributes, rather than whole tags or content blocks.  Since all react directives are stored in a single custom attribute, react has a special set of directives to allow you to manipulate other attribute on the node.

#### `checkedIf(<bool> condition)`:
Sets checked to active on the current node if `condition` is true.  Otherwise, sets it to false.

#### `class(<string> name)`:
Adds the class as specified by `name` to the operative node.

#### `classIf(<bool> condition, <string> name)`:
Adds the class specified by `name` to the operative node if `condition` is true.  Otherwise, removes the class.

#### `attr(<string> attrName, <string/number> value)`:
Sets the attribute specified by `attrName` to the specified value.

#### `attrIf(<bool> condition, <string> name, <string/number> value)`:
Sets the attribute specified by `attrName` to the specified value if `condition` is true.  Otherwise, removes the attribute.

#### `(not yet supported) style(<string> name, <string/number> value)`:
Sets the style property specified by `attrName` to the specified value.

#### `(not yet supported) styleIf(<bool> condition, <string> name, <string/number> value)`:
Sets the style property specified by `attrName` to the specified value if `condition` is true.  Otherwise, removes the style.


***

## Thats a lot of directives!
True, though I believe most are semantically unavoidable, given the constraints and the desired feature set. (I'd would love to hear counterarguments!)  See the "What do I give up for these features?" section for a discussion of why they must exist for completeness sake.  I don't expect much extension of this list.

***

## How does it work?
Under the hood, react adds string annotations to the input template node, the input view object, and all relevant descendants thereof.  To minimize the footprint react has on your objects, the details and object links needed to give these annotations meaning are managed centrally within React.  Whenever you indicate to React that a given property has changed on an object, React checks that object for annotations.  If it finds any relevant ones, it verifies that the annotations have not been invalidated (through rearrangements in DOM or object structure).  It then re-computes any substitutions that depended on those modified properties.  I'm writing a more detailed explanation of the internals for a separate document, so please post any specific questions or in the [github comments](https://github.com/marcusphillips/react/comments) page.

***

## FAQ

#### Does React support subtemplates?
Yes.  Simply include a node that you would like to use as the template on your input view object.  It will be substituted just as a string value would.
