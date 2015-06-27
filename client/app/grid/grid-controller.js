var grid = angular.module('game.grid');

grid.controller('gridCtrl', function($scope, TileModel, GridService, Player, notify) {
  // Declare our controller wide dependencies
  var grid = GridService.matrix;
  var meeplesRemoved = [];
  var meeplePlaced = false;
  var tilePlaced = false;
  notify.config({duration: 1000, templateUrl: 'app/templates/notifications.html'});
  
  $scope.orientation = 0;

  // Set starting number of meeples on grid instantiation.
  // numMeeps should be altered later on only by placing and taking back meeples.
  $scope.numMeeps = 7;

  // Set client's meeple color. This line should only run once (Meeple color doesn't change).
  $scope.meepleColor = 'assets/img/Meeples/meeple_' + Player.getColor() + '.png';

  socket.on('nextTurn', function(gamestate) {
    if (!gamestate.lastTile) {
      $scope.currentTile = new TileModel(gamestate.nextTile);
    } else {
      $scope.currentTile = new TileModel(gamestate.nextTile);
      GridService.updateGrid(gamestate.lastTile.x, gamestate.lastTile.y, gamestate.lastTile);
      GridService.setCell(gamestate.lastTile, 'lastTile');
    }
    if (gamestate.meeplesRemoved && gamestate.meeplesRemoved.length > 0) {
      GridService.updateMeeples(meeplesRemoved);
    }
    meeplesRemoved = []; // Clear the list of meeples removed this turn.
    $scope.src = $scope.currentTile.img;
    $scope.$apply();
  });

  socket.on('numReady', function(data){
    if(_.includes(data.users[0], Player.getUsername())){
      angular.element(document.getElementById('ready')).remove();
    }
  });

  $scope.ready = function(){
    socket.emit('playerReady', Player.getUsername());
  };

  // Needed purely so that ng-repeat works for the meeples display.
  $scope.repeatMeeples = function(numMeeps) {
    return new Array(numMeeps);
  };
  
  $scope.range = function() {
    return new Array(GridService.gridSize);
  };

  $scope.rotate = function() {
    if (Player.isCurrentPlayer() && !tilePlaced) {
      $scope.orientation = ($scope.orientation + 1) % 4;
      $scope.currentTile.rotateRight();
    }
  };

  $scope.clickCell = function(event, x, y) {
    if (!event.shiftKey) {
      if (tilePlaced) {
        setMeeple(event, x, y);
        angular.element(document.getElementById('button-grid'))
          .addClass('rotate-' + $scope.orientation);
      } else {
        setTile(x, y, $scope.currentTile);
      }
    }
  };

  $scope.endTurn = function() {
    if (tilePlaced) {
      tilePlaced = false;
      meeplePlaced = false;
      $scope.orientation = 0;
      socket.emit('endTurn', {tile: $scope.currentTile, meeplesRemoved: meeplesRemoved}); 
    } else {
      notify('Cannot end your turn');
    }
  };

  var setMeeple = function(event, x, y) {
    if ($scope.numMeeps <= 0) {
      notify('All outta meeps');

    } else if (meeplePlaced) {
      notify('You have already placed a meeple this turn.');

    } else if ($scope.currentTile.x === x && $scope.currentTile.y === y) {
        // Assign the meeple's default location.
        $scope.currentTile.meeple.location = 1;
        $scope.currentTile.meeple.color = Player.getColor();
        $scope.numMeeps--;
        // Restrict players to only dropping one meeple per turn by setting the meeplePlaced flag to true.
        meeplePlaced = true;
        
        var meepCoords = 'meep-x-' + x + '-y-' + y;

        angular.element(event.target).append('<img data-coords="'+meepCoords+'" src="'+ $scope.meepleColor +'">');
        $scope.currentMeeple = angular.element(document.querySelector('img[data-coords="'+ meepCoords +'"]'));
        $scope.currentMeeple.on('click',  pickupMeeple);

        // Remove the recently placed meeple from the meeplesRemoved array if necessary.
        // Using an IFFE to ensure the assignment of i to 0 doesn't conflict with anything else.
        (function() {
          for (var i = 0; i < meeplesRemoved.length; i++) {
            // If the recently placed meeple's x and y values match the x/y
            // values of a removed meeple, they are the same meeple. Get it
            // outta there.
            if (meeplesRemoved[i].x === x &&
                meeplesRemoved[i].y === y ) {

              // Remove one meeple from meeplesRemoved, at location i.
              meeplesRemoved.splice(i, 1);
            }
          }
        })();

      } else {
        notify('Can only place meeple on last tile');
      }
  };

  var pickupMeeple = function(event) {
    // Stop the click event from bubbling up through the DOM.
    event.stopPropagation();
    if (Player.isCurrentPlayer()) {
      if (event.shiftKey) {
        var meep = angular.element(event.target);
        var meepData = meep.attr('data-coords');
        var parsedData = meepData.match(/x-(\d)+-y-(\d)+/);

        // Add this meeple to the list of meeples removed this turn.
        // Need to add the unary operator to convert parsedData to numbers.
        meeplesRemoved.push({
          color: Player.getColor(),
          x: +parsedData[1],
          y: +parsedData[2]
        });

        // Compare the recently picked up meeple to the current meeple using their
        // data-coords attributes. If they are identical, remove that meeple from
        // the current tile's meeple property so it does not persist to other
        // clients after removal.
        if (meep.attr('data-coords') === $scope.currentMeeple.attr('data-coords')) {
          $scope.currentTile.meeple = {color: undefined, location: undefined};
        }

        meep.remove();
        $scope.numMeeps++;
        meeplePlaced = false;
        $scope.$apply();
      }
    }
  };

  $scope.cycleMeeple = function(item) {
    if (Player.isCurrentPlayer() && $scope.currentMeeple && meeplePlaced) {     
      var itemID = angular.element(item.target).attr('id');
      $scope.currentMeeple.attr('class', itemID);
      $scope.currentTile.meeple.location = +$scope.currentMeeple.attr('class').slice(-1);
    }
  };

  var setTile = function(x, y, tile) {
    GridService.setTile(x, y, tile, function() {
      tilePlaced = true;
      meeplePlaced = false;
    });
  };

  // Initialize
  (function() {
    GridService.placeInitialTile();
    GridService.resizeGrid();
  })();

});