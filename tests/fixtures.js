var makeFixtureScopes = function(){
  var addAccessors = function(focus){
    focus.set = function(key, value){
      focus[key] = value;
      react.changed(focus, key);
    };
    focus.del = function(key){
      delete focus[key];
      react.changed(focus, key);
    };
    for(var key in focus){
      if(key !== 'set' && focus[key] && typeof focus[key] === 'object' && !focus[key].set){
        addAccessors(focus[key]);
      }
    }
    return focus;
  };

  var scopes = {

    inert: {},

    alice: {
      isAdmin: true,
      email: 'alice@startup.com'
    },

    bob: {
      name: 'bob',
      isVerified: true,
      email: 'bob@webmail.com',
      mugshotUrl: 'example.com',
      friends: [],
      address: {
        street: 'cornell'
      },
      business: {
        address: {
          street: 'main'
        }
      },
      car: {
        color: 'blue',
        name: 'chitty',
        value: '$4000'
      }
    },

    charlie: {
      name: 'charlie'
    },

    david: {
      name: 'david'
    },

    ellen: {
      name: 'ellen'
    },

    hacker: {
    },

    navItems: [
      {text:'home'},
      {text:'profile'},
      {text:'settings'}
    ]

  };

  scopes.bob.friends.push(scopes.charlie, scopes.david, scopes.ellen);

  return addAccessors(scopes);
}