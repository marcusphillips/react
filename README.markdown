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
In fact, the output template is equivalent to the the input template, but with appropriate substitutions.  In the process, It retains all its original directives that were used to control rendering.  Directives are things like 'loop' and 'contain' that tell the engine what to do to the template - in some template languages, these are expressed with a custom syntax like `{{…}}` or `<?…?>`.  But since React directives are all contained in custom DOM attributes, they can be preserved between render updates.

#### React can manage those view updates for you
Thanks to the previous feature, the library is also capable of managing all view updates, without you manually calling for them.  If you use this auto-rerender feature (or 'anchor'), you can delete large swaths of your view code that were previously responsible for keeping DOM output in sync with model state.  For example, that would includ most jQuery operations, such as `$('#mySelector').css({color:'red'}).show()`.

#### React helps your app gracefully scale through complexity
Often in small applications, view management code is small enough to go unnoticed.  But as the app grows complex, view management becomes exponentially harder, since each subsequent feature has to be respectful of more and more existing features.  Afterall, they share a common DOM tree, and each one can impose new expectations on it.  A handshake problem develops as the growing number of features mutate this single resource (see [exponential complexity and the handshake problem](http://en.wikipedia.org/wiki/Triangular_number)).  In essence, while object orientation allows us to divide and conquer app logic, this single, shared view resource (the DOM) mixes it all together again.  Reactive data binding can resolve that.

#### Plays nice with others
What set's React apart from other reactive data binding libraries is its emphasis on compatibility and minimal imposition.  It is compatible with nearly every other JavaScript library and pattern you might be using.

#### Standard building blocks
When rendering templates, React accepts any vanilla JavaScript object, not just a custom class or special data format.  Similarly, the input template can be any valid string of HTML or a memory reference to an existing node.  The output will always be a DOM node reference, but with appropriate substitutions.  (A string output mode is planned for later versions, primarily for use on the server-side.)

#### Intrinsic XSS protection
Since React achieves template substitutions by way of a builder pattern, the browser can always correctly escape your input for the given context.  This is an inherent advantage to builder patterns in general.  Injection attacks occur when an attacker can define part of a string that will eventually be interpreted by some part of the system as if it were code.  With builder patterns, the line between code and input is clear unless you work to blur it, rather than the other way around.  Note that React can't prevent all XSS vulnerabilities in your app, but does make the problem much easier to solve.

#### Any valid HTML snippet is a valid React template, and vice-versa
React doesn't require anything special in your HTML except when you want to tell it what to do at render time, and it never relies on ucing reactive bindings to an existing code base litaupplied key fails on the topmost scope, it falls through to the next highest scope in the chain, and so on until it succeeds or exhausts the chain.
- Keys support dot notation (`key.subKey`) for selecting a nested property.
- Multiple, comma-delimited directives can be provided in a single `react` attribute.  They will be processed sequentially left-to-right, and inherit  each execute in the environment left by the previous one.

***

## What are all the React directives?

#### `contain(<string/number/DOM> value)`
Inserts `value` as the contents of the node

#### `within(<string> key)`
Takes the value found at `key` in the scope chain, and adds it to the top of the scope chain.  Useful for subtemplates, and when dealing with many different properties of a single, nested object.  The behavior is identical to that of Mustache's dereferencing feature.

#### `loop()`
Loops over the top-most object in the scope chain, generating a new node for each property.  Each new node is a duplicate of the item template node (first child of the looping node), and gets appended inside the results container node (second child of the looping node).  The generated item nodes are each then evaluated, inheriting their scope chain from the loop node, but with their respective item value pushed onto it.

Note: The method assumes the top-most scope object is enumerable.

Note: To improve speed and consistency, item nodes are not regenerated on subsequent calls to `update()`.  The `loop()` method will just assume that any node it finds in the results container node was generated by the loop, and will attempt to re-use it.

#### `loop as ([<string> indexAlias,] <*> valueAlias)`
Operates the same as as a normal call to loop, but instead of pushing each item onto the scope chain, it adds an alias binding for the item value, and optionally, for the key.

#### `displayIf(<bool> condition)`
Sets the CSS property `display` to `none` if `condition` is false, and back to the default if it is true

#### `visIf(<bool> condition)`
Sets the CSS property `visibility` to `hidden` if `condition` is false, and back to default if it is true

#### `checkedIf(<bool> condition)`
Sets checked to active on the current node if `condition` is true.  Otherwise, sets it to false.

#### `class(<string> name)`
Adds the class as specified by `name` to the operative node.

#### `classIf(<bool> condition, <string> name)`
Adds the class specified by `name` to the operative node if `condition` is true.  Otherwise, removes the class.

#### `attr(<string> attrName, <string/number> value)`
Sets the attribute specified by `attrName` to the specified value.

#### `attrIf(<bool> condition, <string> name, <string/number> value)`
Sets the attribute specified by `attrName` to the specified value if `condition` is true.  Otherwise, removes the attribute.

#### `(not yet supported) style(<string> name, <string/number> value)`
Sets the style property specified by `attrName` to the specified value.

#### `(not yet supported) styleIf(<bool> condition, <string> name, <string/number> value)`
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
