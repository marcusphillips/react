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
      name: 'alice',
      isAdmin: true,
      email: 'alice@startup.com',
      address: {
        street: 'cornell'
      },
      business: {
        address: {
          street: 'main'
        }
      },
      mugshotUrl: 'example.com',
      friends: [],
      car: {
        color: 'blue',
        name: 'chitty',
        value: '$4000'
      }
    },

    bob: {
      name: 'bob',
      isVerified: true,
      email: 'bob@webmail.com'
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

  scopes.people = [scopes.alice, scopes.bob, scopes.charlie, scopes.david, scopes.ellen];
  for(var i = 0; i < scopes.people.length; i++){
    if(i){ scopes.alice.friends.push(scopes.people[i]); }
    if(i !== scopes.people.length){ scopes.people[i].neighbor = scopes.people[i+1]; }
  }

  return addAccessors(scopes);
}