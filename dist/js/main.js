const socket = io();

const returnButton = document.getElementById('returnButton')
const hostButton = document.querySelector('[data-text="host"]')
const joinButton = document.querySelector('[data-text="join"]')
const rematchButton = document.querySelector('#rematchButton')

returnButton.addEventListener('click', () => {
  if (document.getElementById('game').style.display != "none") {
    socket.emit('deleteGame', '')
    resetGame()
  }
  switchScreen('menu');
})

hostButton.addEventListener('click', () => {
  socket.emit('createGame', "");
})

joinButton.addEventListener('click', () => {
  switchScreen('list')

  socket.emit('gamesList', "");
})

rematchButton.addEventListener('click', () => {
  socket.emit('rematchVote');
})

function switchScreen(pageToGet) {
  const game = document.getElementById('game');
  const menu = document.getElementById('menu');
  const list = document.getElementById('list');
  const retButt = document.getElementById('returnButton')

  game.style.display = "none"
  menu.style.display = "none"
  list.style.display = "none"
  retButt.style.display = "none"

  switch (pageToGet) {
    case "game": {
      game.style.display = "flex"
      retButt.style.display = "block"
      break
    }
    case "menu": {
      menu.style.display = "block"
      break
    }
    case "list": {
      list.style.display = "flex"
      retButt.style.display = "block"
      break
    }
  }
}


//
// GAME CODE 
//

// Setup all tiles, for now only 15x15

const boardSize = 15;

function createBoard() {
  const parent = document.querySelector('#gameBoard');
  for (var i = 0; i < boardSize ** 2; i++) {
    let div = document.createElement('div');
    let placement = i
    div.classList.add('tile');
    div.addEventListener('click', (e) => {
      // e.target.dataset.value = symbolAdjust()
      // e.target.style.backgroundImage = symbolPlace()
      console.log(placement)
      socket.emit('sendMove', placement);
    })
    parent.append(div);
  }
}

const tiles = document.getElementsByClassName('tile');


// PLACE RIGHT SYMBOL

function symbolAdjust(player) {
  if (player == "o") return "o"
  return "x"
}

function symbolPlace(player) {
  if (player == "o") return "url('../img/circle.png')"
  return "url('../img/cross.png')"
}

// Socket events
socket.on('gamesList', (games) => {
  const ul = document.querySelector('#list > #gameList')
  while (ul.children[0]) {
    ul.removeChild(ul.lastChild)
  }
  for (var i in games) {
    if (!games[i].guest && !games[i].finished) {
      let li = document.createElement('li');
      li.dataset.host = games[i].host
      li.innerHTML = "Host: " + games[i].host
      li.addEventListener('click', (e) => {
        socket.emit('joinGame', e.target.dataset.host)
        switchScreen('game')
      })
      ul.append(li)
    }
  }
})

socket.on('gameCreated', () => {
  switchScreen('game')
  console.log("game created !")
})

socket.on('waitingForOpponent', () => {
  document.querySelector('#game').classList.add("waitingForOpponent")
})

socket.on('opponentJoin', () => {
  const game = document.querySelector('#game')
  game.classList.add("dissapear")
  setTimeout(() => {
    game.classList.remove("waitingForOpponent")
    game.classList.remove("dissapear")
  }, 1000)
})

socket.on('chooseSide', (e) => {
  document.querySelector('#player').dataset.text = e
})

// socket.emit('createGame', "")

socket.on('onTurn', () => {
  document.querySelector('#player').classList.toggle('active')
  titleNotification()
})

socket.on('placeMove', (arrayOfInfo) => {
  tiles[+arrayOfInfo[0]].style.backgroundImage = symbolPlace(arrayOfInfo[1])
  tiles[+arrayOfInfo[0]].dataset.value = symbolAdjust(arrayOfInfo[1])
})

socket.on('finishGame', (string) => {
  console.log(string)
  document.querySelector('#victorySymbol').innerHTML = string + " have won !"
  document.querySelector('#game').classList.add('endScreen')

})

socket.on('rematchVoteStatus', (e) => {
  document.querySelector('#rematchCount').innerHTML = e + "/2"
})

socket.on('remtachVotePassed', () => {
  resetGame()
  document.querySelector('#rematchCount').innerHTML = "0/2"
  document.querySelector('#endScreen').classList.add('hidden')
  setTimeout(() => {
    document.querySelector('#game').classList.remove('endScreen')
    document.querySelector('#endScreen').classList.remove('hidden')
    document.querySelector('#endScreen').classList.add('show')
  }, 1500)
})

socket.on('resetGame', () => {
  resetGame()
  resetGameScreen()
})

function titleNotification() {
  if (document.querySelector('#player').classList.contains("active")) {
    document.title = "▼ Piškvorky";
  }
  else {
    document.title = "Piškvorky";
  }
  // let interval1 = setInterval(() => {
  //   document.title = "▼ Piškvorky";
  //   setTimeout(() => {
  //     clearInterval(interval1)
  //   }, 3000)
  // }, 1000)
  // let interval2 = setTimeout(() => {
  //   setInterval(() => {
  //     document.title = "Piškvorky";
  //     setTimeout(() => {
  //       clearInterval(interval2)
  //     }, 3000)
  //   }, 1000)
  // }, 500)
}

function resetGame() {
  for (var i = 0; i < tiles.length - 1; i++) {
    tiles[i].style.backgroundImage = "none"
    tiles[i].dataset.value = ''
  }
  document.title = "Piškvorky";
}

function resetGameScreen() {
  document.querySelector('#rematchCount').innerHTML = "0/2"
  document.querySelector('#game').classList.remove('endScreen')
  document.querySelector('#endScreen').classList.remove('hidden')
  document.querySelector('#endScreen').classList.add('show')
  if (document.querySelector('#player').classList.contains('active')) {
    document.querySelector('#player').classList.remove('active')
  }
}

// Setuping Game

createBoard()