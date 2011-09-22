var makeFixtures = function(){

  var addAccessors = function(focus){

    focus.anchor = function(node){
      $(node).anchor(this);
      return this;
    };

    focus.set = function(key, value){
      if(typeof key === 'object'){
        var newValues = key;
      } else {
        newValues = {};
        newValues[key] = value;
      }
      for(key in newValues){
        focus[key] = newValues[key];
      }
      react.changed(focus, js.keys(newValues));
    };

    focus.del = function(keys){
      keys = js.isArray(keys) ? keys : [keys];
      for(var i = 0; i < keys.length; i++){
        delete focus[keys[i]];
      }
      react.changed(focus, keys);
    };

    for(var key in focus){
      if(key !== 'set' && focus[key] && typeof focus[key] === 'object' && !focus[key].set){
        addAccessors(focus[key]);
      }
    }

    return focus;
  };

  var fixtures = {

    inert: {},

    shopping: ['cheese', 'eggs', 'milk'],

    ticTacToe: [
      [{symbol:'x'}, {symbol:'o'}, {symbol:'x'}],
      [{symbol:'o'}, {symbol:'x'}, {symbol:'o'}],
      [{symbol:'x'}, {symbol:'o'}, {symbol:'x'}]
    ],

    people: [{

      name: 'alice',
      username: 'alice00',
      isAdmin: true,
      email: 'alice@startup.com',
      pet: {
        alergy: undefined
      },
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

    },{

      name: 'bob',
      address: {
        street: 'cherry'
      },
      alergy: 'wheat',
      pet: {
        alergy: 'chocolate'
      },
      isVerified: true,
      email: 'bob@webmail.com'

    },{

      name: 'charlie',
      pet: {
      }

    },{

      name: 'david'

    },{

      name: 'ellen'

    },{

      name: 'hacker'

    }],

    navItems: [
      {text:'home'},
      {text:'profile'},
      {text:'settings'}
    ]

  };

  for(var i = 0; i < fixtures.people.length; i++){
    var person = fixtures.people[i];
    fixtures[person.name] = person;
    person.capsName = function(){ return this.name.toUpperCase(); };
    person.popularity = function(){ return this.friends.length; }; // must use 'this' keyword

    person.friends = [];
    // each fixture person is friends with all lower-indexed people
    for(var whichFriend = 0; whichFriend < i; whichFriend++){
      person.friends.push(fixtures.people[whichFriend]);
    }
    if(fixtures.people[i+1]){ person.neighbor = fixtures.people[i+1]; }
  }

  return addAccessors(fixtures);
}