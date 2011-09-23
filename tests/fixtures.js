var makeFixtures = function(){

  var fixtures = {

    inert: {},

    shopping: ['cheese', 'eggs', 'milk'],

    ticTacToe: [
      [{symbol:'x'}, {symbol:'o'}, {symbol:'x'}],
      [{symbol:'o'}, {symbol:'x'}, {symbol:'o'}],
      [{symbol:'x'}, {symbol:'o'}, {symbol:'x'}]
    ],

    posts: {
      havingFun: {
        isPublished: true
      }
    },

    people: [{

      name: 'alice',
      username: 'alice00',
      title: 'ms',
      isAdmin: true,
      isVerified: true,
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

      name: 'ellen',

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

  return react.helpers(fixtures, true);
}