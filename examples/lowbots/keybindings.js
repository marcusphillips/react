$(document).keydown(function(event){
  var directionTranslationMatrix = {
    37: 'west',
    38: 'north',
    39: 'east',
    40: 'south'
  };
  var direction = directionTranslationMatrix[event.keyCode];
  if(direction){
    move[direction]();
  }
  var robotTranslationMatrix = {
    82: 'red',
    71: 'green',
    66: 'blue',
    89: 'yellow'
  };
  var robot = robotTranslationMatrix[event.keyCode];
  if(robot){
    select_robot(color_robot_mapping[robot]);
  }
  if(event.keyCode === 27){
    reset();
    drawBoard(board);
  }
});
