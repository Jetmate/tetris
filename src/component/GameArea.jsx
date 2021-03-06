import React from 'react'

import style from './stylesheet.css'
import { COLORS, GRID_COLOR, PIECES } from '../common/constants.js'

class Component extends React.Component {
  constructor (props) {
    super(props)

    this.BLOCK_WIDTH = this.props.blockWidth || 45
    if (this.props.fullScreen) {
      this.VISUAL_GRID_HEIGHT = Math.floor(window.innerHeight / this.BLOCK_WIDTH)
      this.GRID_WIDTH = Math.floor(window.innerWidth / this.BLOCK_WIDTH)
    } else {
      this.VISUAL_GRID_HEIGHT = this.props.gridHeight || 20
      this.GRID_WIDTH = this.props.gridWidth || 20
    }
    this.WIDTH = this.GRID_WIDTH * this.BLOCK_WIDTH
    this.HEIGHT = this.VISUAL_GRID_HEIGHT * this.BLOCK_WIDTH

    this.INITIAL_UPDATE_WAIT = 400
    this.FINAL_UPDATE_WAIT = 50
    this.SKIP_WAIT = false

    this.nextPiece = null

    if (this.props.socket) {
      this.props.socket.on('choice', (data) => {
        if (data['id'] === opponent) {
          this.nextPiece = data['choice']
        }
      })
    }
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.transition) {
      this.SKIP_WAIT = true
    }
  }

  render () {
    return (
      <canvas className={this.props.className + ' ' + (this.props.background ? style.GameArea : '')} style={this.props.transition ? {animationPlayState: 'running'} : {}} ref={this.canvasCallback} />
    )
  }

  canvasCallback = (canvas) => {
    const HIDDEN_HEIGHT = 3
    const GRID_HEIGHT = this.VISUAL_GRID_HEIGHT + HIDDEN_HEIGHT
    const KEY_RIGHT = 39
    const KEY_LEFT = 37
    const KEY_ROTATE = 38
    const KEY_DROP = 40


    const randRange = (upper) => {
      return Math.floor(Math.random() * upper)
    }

    const randomItem = (array) => {
      return array[randRange(array.length)]
    }

    const randomColor = () => {
      return randomItem(COLORS)
    }

    const deepCopy = (array) => {
      let new_array = []
      for (let item of array) {
        new_array.push(item.slice())
      }
      return new_array
    }

    const generateNewPiece = () => {
      let piece
      if (this.nextPiece !== null) {
        piece = deepCopy(PIECES[this.nextPiece])
        this.nextPiece = null
      } else {
        piece = deepCopy(randomItem(PIECES))
      }
      let x = randRange(this.GRID_WIDTH - (piece[0][0] + 1))
      for (let i = 0; i < piece.length; i++) {
        piece[i][0] += x
      }
      return piece
    }

    const createGrid = () => {
      let grid = []
      for (let i = 0; i < this.GRID_WIDTH; i++) {
        grid[i] = new Array(GRID_HEIGHT)
      }
      return grid
    }

    const isSquare = (piece) => {
      // ambiguous formula for determining square (PIECE ORDER KEY)
      if (piece[0][0] - piece[1][0] === 1 && piece[0][1] - piece[1][1] === 1) {
        return true
      }
      return false
    }

    const rotatePiece = (piece, pieceId, grid) => {
      // if is square, don't rotate
      if (isSquare(piece)) {
        return piece
      }
      let rotatedPiece = []
      for (let [x, y] of piece) {
        let offset = [piece[1][0] - x, piece[1][1] - y]
        offset[1] *= -1
        let newBlock = [piece[1][0] + offset[1], piece[1][1] + offset[0]]
        if (
          newBlock[0] < this.GRID_WIDTH && newBlock[0] >= 0 && newBlock[1] < GRID_HEIGHT && newBlock[1] >= 0 &&
          (typeof grid[newBlock[0]][newBlock[1]] === 'undefined' || grid[newBlock[0]][newBlock[1]] === pieceId)
          ) {
          rotatedPiece.push(newBlock)
        } else {
          return piece  
        }
      }
      return rotatedPiece
    }

    const movePiece = (piece, pieceId, grid, direction) => {
      let movedPiece = []
      for (let [x, y] of piece) {
        if ((x + direction < 0 || x + direction >= this.GRID_WIDTH) ||
            (typeof grid[x + direction][y] !== 'undefined' && grid[x + direction][y] !== pieceId)
          ) {
          // if next to piece or next to edge don't move
          return piece
        } else {
          movedPiece.push([x + direction, y])
        }
      }
      return movedPiece
    }

    const dropPiece = (currentPiece, currentPieceId, grid) => {
      while (true) {
        let results = updatePiece(grid, currentPiece, currentPieceId, false)
        if (results[1] !== currentPieceId) {
          break
        }
        currentPiece = results[0]
        grid = updateGrid(grid, currentPiece, currentPieceId)
      }
      return currentPiece
    }

    const updatePiece = (grid, currentPiece, currentPieceId) => {
      let gameOver = false

      // check if piece reached bottom
      let crashed = false
      for (let [x, y] of currentPiece) {
        if ((y === GRID_HEIGHT - 1) ||
            (typeof grid[x][y + 1] !== 'undefined' && grid[x][y + 1] !== currentPieceId)
          ) {
          crashed = true
          break
        }
      }

      let newPiece
      if (crashed) {
        // if current piece is not completely on the board, set 'gameOver'
        for (let [x, y] of currentPiece) {
          if (y < HIDDEN_HEIGHT) {
            gameOver = true
          }
        }
        // else, generate a new piece
        newPiece = generateNewPiece()
        currentPieceId += 1
      } else {
        // move current piece down
        newPiece = []
        for (let [x, y] of currentPiece) {
          newPiece.push([x, y + 1])
        }
      }

      return [newPiece, currentPieceId, gameOver, crashed]
    }

    const copyOverGrid = (oldGrid, newGrid, currentPieceId) => {
      // copy over the grid except for current piece
      for (let x = 0; x < this.GRID_WIDTH; x++) {
        for (let y = 0; y < GRID_HEIGHT; y++) {
          if (typeof oldGrid[x][y] !== 'undefined' && oldGrid[x][y] !== currentPieceId) {
            newGrid[x][y] = oldGrid[x][y]
          }
        }
      }
    }

    const applyPieceToGrid = (grid, piece, pieceId) => {
      for (let [x, y] of piece) {
        grid[x][y] = pieceId
      }
    }

    const checkForFull = (grid) => {
      for (let y = 0; y < GRID_HEIGHT; y++) {
        let fullRow = true
        for (let x = 0; x < this.GRID_WIDTH; x++) {
          if (typeof grid[x][y] === 'undefined') {
            fullRow = false
            break
          }
        }
        if (fullRow) {
          for (let x = 0; x < this.GRID_WIDTH; x++) {
            grid[x][y] = 'undefined'
            for (let y2 = y; y2 >= 0; y2--) {
              grid[x][y2 + 1] = grid[x][y2] 
            }
          }
        }
      }
    }

    const drawGrid = (grid, drawGridLines=true) => {
      // clear screen
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      if (drawGridLines) {
        // draw new grid
        ctx.strokeStyle = GRID_COLOR
        for (let x = 0; x <= this.GRID_WIDTH; x++) {
          ctx.beginPath()
          ctx.moveTo(x * this.BLOCK_WIDTH, 0)
          ctx.lineTo(x * this.BLOCK_WIDTH, canvas.height)
          ctx.stroke()
        }
        for (let y = 0; y <= GRID_HEIGHT; y++) {
          ctx.beginPath()
          ctx.moveTo(0, y * this.BLOCK_WIDTH)
          ctx.lineTo(canvas.width, y * this.BLOCK_WIDTH)
          ctx.stroke()
        }
      }

      // draw new pieces
      for (let x = 0; x < this.GRID_WIDTH; x++) {
        for (let y = 0; y < GRID_HEIGHT; y++) {
          if (typeof grid[x][y] !== 'undefined' && grid[x][y] !== null) {
            // when the colors run out, loops back to the first one
            ctx.fillStyle = COLORS[grid[x][y] - COLORS.length * Math.floor(grid[x][y] / COLORS.length)]
            ctx.fillRect(x * this.BLOCK_WIDTH, (y - HIDDEN_HEIGHT) * this.BLOCK_WIDTH, this.BLOCK_WIDTH, this.BLOCK_WIDTH)
          }
        }
      }
    }

    const updateGrid = (grid, currentPiece, currentPieceId) => {
      let newGrid = createGrid()
      copyOverGrid(grid, newGrid, currentPieceId)
      applyPieceToGrid(newGrid, currentPiece, currentPieceId)
      return newGrid
    }

    const movePieces = (grid, full=false) => {
      for (let x = 0; x < this.GRID_WIDTH; x++) {
        for (let y = 1; y < (GRID_HEIGHT + (full ? 1 : 0)); y++) {
          if (typeof grid[x][y] !== 'undefined' || full) {
            grid[x][y - 1] = grid[x][y]
          }
        }
      }
    }

    const checkIfDone = (grid) => {
      let isUndefined
      let doneChecking
      let done = true
      for (let x = 0; x < this.GRID_WIDTH; x++) {
        isUndefined = false
        doneChecking = false
        for (let y = 0; y < GRID_HEIGHT; y++) {
          if (typeof grid[x][y] === 'undefined' && !doneChecking) {
            isUndefined = true
          } else {
            doneChecking = true
          }
        }
        if (isUndefined && doneChecking) {
          done = false
        }
      }
      return done
    }

    const checkIfDone2 = (grid) => {
      let done = true
      for (let x = 0; x < this.GRID_WIDTH; x++) {
        for (let y = 0; y < GRID_HEIGHT; y++) {
          if (typeof grid[x][y] !== 'undefined') {
            done = false
          }
        }
      }
      return done
    }

    const calculateLevel = (time) => {
      return (1 / (1 + Math.E ** (time / 4   - 5))) * 350 + 50
    }

    canvas.width = this.WIDTH
    canvas.height = this.HEIGHT
    const ctx = canvas.getContext('2d')

    let grid = createGrid()
    let currentPiece = generateNewPiece()
    let currentPieceId = 0

    let updateTime = 0
    let phase = 'playing'
    let currentUpdateWait = 0
    drawGrid(grid)

    const update = (timeStamp) => {
      if (((timeStamp - updateTime > currentUpdateWait) || this.SKIP_WAIT) && !this.props.pause) {
        updateTime = timeStamp
        if (phase === 'transition1') {
          movePieces(grid)
          drawGrid(grid)
          if (checkIfDone(grid)) {
            phase = 'transition2'
          }
        } else if (phase === 'transition2') {
          movePieces(grid, true)
          drawGrid(grid, false)
          if (checkIfDone2(grid)) {
            window.location = this.props.transition
            return
          }
        } else {
          if (this.props.transition) {
            currentPiece = dropPiece(currentPiece, currentPieceId, grid)
            grid = updateGrid(grid, currentPiece, currentPieceId)
            checkForFull(grid)
          }
          if (!this.props.background) {
            currentUpdateWait = calculateLevel(currentPieceId)
          }
          let results = updatePiece(grid, currentPiece, currentPieceId)
          currentPiece = results[0]
          currentPieceId = results[1]
          grid = updateGrid(grid, currentPiece, currentPieceId)
          checkForFull(grid)
          drawGrid(grid)
          if (this.props.socket) {
            this.props.socket.emit('move', {'id': id, 'grid': grid})
            if (results[3] ) {
              this.props.socket.emit('crash', {'id': id}) 
            }
          }
          if (results[2]) {
            if (this.props.transition) {
              phase = 'transition1'
            } else if (this.props.background) {
              grid = createGrid()
            } else {
              this.props.onGameOver()
              return
            }
          }
        }
      }
      window.requestAnimationFrame(update)
    }

    if (this.props.inputSocket) {
      this.props.inputSocket.on('move', (data) => {
        if (data['id'] == opponent) {
          drawGrid(data['grid'])
        }
      })
    } else {
      window.requestAnimationFrame(update)
    }

    if (this.props.interactive) {
      document.addEventListener('keyup', (event) => {
        if (!this.props.pause) {
          if (event.keyCode === KEY_DROP) {
            currentPiece = dropPiece(currentPiece, currentPieceId, grid)
            grid = updateGrid(grid, currentPiece, currentPieceId)
            checkForFull(grid)
            drawGrid(grid)
          }
        }
      })

      document.addEventListener('keydown', (event) => {
        if (!this.props.pause) {
          if (event.keyCode === KEY_LEFT) {
            currentPiece = movePiece(currentPiece, currentPieceId, grid, -1)
          } else if (event.keyCode === KEY_RIGHT) {
            currentPiece = movePiece(currentPiece, currentPieceId, grid, 1)
          } else if (event.keyCode === KEY_ROTATE) {
            currentPiece = rotatePiece(currentPiece, currentPieceId, grid)
          } else {
            return
          }
          grid = updateGrid(grid, currentPiece, currentPieceId)
          checkForFull(grid)
          drawGrid(grid)
        }
      })
    }
  }
}

export default Component
