const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("dist"))

// USER INFO

let users = []
let games = []

io.on('connection', (socket) => {
  users.push(socket)
  console.log(`User ${socket.id} has connected.`);

  socket.on('disconnect', () => {
    console.log(`User ${socket.id} has disconnected.`);
    users.splice(users.indexOf(socket), 1)
    leaveGame(socket)
  })

  socket.on('createGame', () => {
    games.push({
      host: socket.id,
      guest: '',
      gameTiles: [],
      finished: false,
      playerStart: 'host',
      lastPlay: 'guest',
      hostSymbol: 'o',
      guestSymbol: 'x',
      rematchVote: {
        host: false,
        guest: false,
        total: 0
      }
    })
    for (var i = 0; i < 15 ** 2; i++) {
      games[games.length - 1].gameTiles[i] = ''
    }
    socket.emit('gameCreated', "");
    waitingForOpponentActivate(games[games.length - 1])
    socket.emit('chooseSide', games[games.length - 1].hostSymbol);
  })

  socket.on('deleteGame', () => {
    leaveGame(socket)
  })

  socket.on('gamesList', () => {
    socket.emit('gamesList', games);
  })

  socket.on('joinGame', (game) => {
    gameByGuest = games[getGameByHostName(game)]
    gameByGuest.guest = socket.id;
    socket.join(games[getGameByHostName(game)].host);
    opponentJoined(gameByGuest);
    socket.emit('chooseSide', gameByGuest.guestSymbol);
    sendYourTurn(gameByGuest);
  })

  socket.on('sendMove', (msg) => {
    if (games[getGameByName(socket.id)].guest) {
      let room = [...socket.rooms][[...socket.rooms].length - 1]
      let game = games[getGameByHostName(room)]
      if ((game.guest == socket.id && game.lastPlay != "guest" && !game.gameTiles[+msg])
        || (game.host == socket.id && game.lastPlay != "host" && !game.gameTiles[+msg])) {
        console.log("Game id = " + room + "- last move was: " + msg)
        let player = (socket.id == room) ? "host" : "guest"
        let playerSymbol = (player == "host") ? game.hostSymbol : game.guestSymbol
        io.in(room).emit('placeMove', [msg, playerSymbol])
        game.lastPlay = player
        game.gameTiles[+msg] = playerSymbol
        if (checkForWin(game.gameTiles, playerSymbol, msg)) {
          game.finished = true
          endGame(game.lastPlay, game)
        }
        io.in(room).emit('onTurn');
      }
    }
  });

  socket.on('rematchVote', () => {
    if (games[getGameByHostName([...socket.rooms][socket.rooms.size - 1])]) {
      let game = games[getGameByHostName([...socket.rooms][socket.rooms.size - 1])]
      let user = (game.host == socket.id) ? "host" : "guest"
      if (!game.rematchVote[user]) {
        game.rematchVote[user] = true
        game.rematchVote.total += 1
        io.in(game.host)
          .emit('rematchVoteStatus', game.rematchVote.total)
      }
      checkRematchTotal(game)
    }
  })
});

server.listen(5000, () => {
  console.log('listening on *: 5000');
});

function leaveGame(socket) {
  let game = getGameByHostName(socket.id)
  let gameByGuest = getGameByGuestName(socket.id)
  let win
  try {
    win = ((game) ? games[game].finished : games[gameByGuest].finished)
  }
  catch (e) {
    win = "nothing"
  }
  if (game) {
    if (!win) endGameByLeave(games[game], games[game].guest)
    socket.emit('resetGame')
    let guestSocket = users[getUserById(games[game].guest)]
    if (games[game].guest) {
      guestSocket.leave(games[game].host)
    }
    games.splice(game, 1)
  }
  else if (gameByGuest) {
    socket.leave(games[gameByGuest].host)
    if (!win) endGameByLeave(games[gameByGuest], games[gameByGuest].host)
    socket.emit('resetGame')
    games[gameByGuest].guest = ''
  }
  else {
    socket.emit('resetGame');
  }
}

function getGameByHostName(name) {
  for (var i in games) {
    if (games[i].host == name) {
      return i
    }
  }
}

function getGameByGuestName(name) {
  for (var i in games) {
    if (games[i].guest == name) {
      return i
    }
  }
}

function getGameByName(name) {
  for (var i in games) {
    if (games[i].host == name) return i
    else if (games[i].guest == name) return i
  }
}

function getUserById(id) {
  for (var i in users) {
    if (users[i].id == id) {
      return i
    }
  }
}

function waitingForOpponentActivate(game) {
  io.to(game.host).emit("waitingForOpponent");
}

function opponentJoined(game) {
  io.to(game.host).emit("opponentJoin");
}

function sendYourTurn(game) {
  let player = (game.lastPlay == "host") ? "guest" : "host"
  if (player == "host") {
    io.to(game[player]).emit("onTurn")
    io.to(game.guest).emit("onTurn")
  }
  else {
    io.to(game.guest).emit("onTurn")
  }
}

function checkRematchTotal(game) {
  let userCount = 1;
  if (game.guest) userCount++;
  if (game.rematchVote.total >= userCount) {
    resetGame(game)
    if (!game.guest) {
      io.to(game.host).emit("waitingForOpponent")
    }
  }
}

function resetGame(game) {
  // {
  //   host: socket.id,
  //   guest: '',
  //   gameTiles: [],
  //   finished: false,
  //   playerStart: 'host',
  //   lastPlay: 'guest',
  //   hostSymbol: 'o',
  //   guestSymbol: 'x',
  //   rematchVote: {
  //     host: false,
  //     guest: false,
  //     total: 0
  //   }
  game.gameTiles = []
  game.finished = false
  if (game.playerStart == "host") {
    game.playerStart = "guest"
    game.lastPlay = "host"
    game.hostSymbol = "x"
    game.guestSymbol = "o"
  } else {
    game.playerStart = "host"
    game.lastPlay = "guest"
    game.hostSymbol = "o"
    game.guestSymbol = "x"
  }
  game.rematchVote.host = false
  game.rematchVote.guest = false
  game.rematchVote.total = 0
  io.in(game.host).emit('chooseSide', game.hostSymbol)
  io.to(game.guest).emit('chooseSide', game.guestSymbol)
  io.in(game.host).emit('remtachVotePassed')
}

// GAME CONTROL

function checkForWin(gameArray, symbol, tile) {
  let points = 1
  let startPoint = tile
  let startPointX = startPoint % 15
  let startPointY = Math.floor(startPoint / 15)
  let new2dArray = [
    [], [], [], [], [], [], [], [], [], [], [], [], [], [], []
  ]
  for (var i = 0; i < 15 ** 2; i++) {
    new2dArray[Math.floor(i / 15)][i % 15] = gameArray[i]
  }

  let variable = 1

  // FIRST LOOP
  while (new2dArray[startPointY][startPointX + variable] == symbol) {
    points++
    variable++
  }

  variable = 1

  while (new2dArray[startPointY][startPointX - variable] == symbol) {
    points++
    variable++
  }

  if (points == 5) {
    return true
  }

  variable = 1

  // SECOND LOOP 
  points = 1
  while (new2dArray[startPointY + variable] && new2dArray[startPointY + variable][startPointX] == symbol) {
    points++
    variable++
  }

  variable = 1

  while (new2dArray[startPointY - variable] && new2dArray[startPointY - variable][startPointX] == symbol) {
    points++
    variable++
  }

  if (points == 5) {
    return true
  }

  variable = 1

  // THIRD LOOP 
  points = 1
  while (new2dArray[startPointY - variable] && new2dArray[startPointY - variable][startPointX + variable] == symbol) {
    points++
    variable++
  }

  variable = 1

  while (new2dArray[startPointY + variable] && new2dArray[startPointY + variable][startPointX - variable] == symbol) {
    points++
    variable++
  }

  if (points == 5) {
    return true
  }
  variable = 1
  // FOURTH LOOP 
  points = 1
  while (new2dArray[startPointY - variable] && new2dArray[startPointY - variable][startPointX - variable] == symbol) {
    points++
    variable++
  }

  variable = 1

  while (new2dArray[startPointY + variable] && new2dArray[startPointY + variable][startPointX + variable] == symbol) {
    points++
    variable++
  }

  if (points == 5) {
    return true
  }

  return false
}

function endGame(player, game) {
  io.in(game.host).emit('finishGame', (game[player + "Symbol"] == "o") ? "CIRCLES" : "CROSSES")
}

function endGameByLeave(game, player) {
  let result = (player == game.host) ? "host" : "guest"
  let string = "User has left - " + ((game[result + "Symbol"] == "o") ? "CIRCLES" : "CROSSES")
  game.finished = true
  io.to(player).emit('finishGame', string)
}