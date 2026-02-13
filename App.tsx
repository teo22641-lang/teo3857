
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Direction, Position, Ghost, TileType, GameState } from './types';
import { INITIAL_MAP, GRID_WIDTH, GRID_HEIGHT, GAME_SPEED, POWER_DURATION } from './constants';
import { getGameAdvice } from './services/gemini';

const App: React.FC = () => {
  const [map, setMap] = useState<number[][]>(INITIAL_MAP.map(row => [...row]));
  const [pacman, setPacman] = useState<Position>({ x: 9, y: 16 });
  const [pacmanDir, setPacmanDir] = useState<Direction>('STATIONARY');
  const [nextDir, setNextDir] = useState<Direction>('STATIONARY');
  const [ghosts, setGhosts] = useState<Ghost[]>([
    { id: '1', type: 'Blinky', color: '#FF0000', position: { x: 9, y: 9 }, direction: 'UP', isVulnerable: false, isDead: false },
    { id: '2', type: 'Pinky', color: '#FFB8FF', position: { x: 8, y: 10 }, direction: 'UP', isVulnerable: false, isDead: false },
    { id: '3', type: 'Inky', color: '#00FFFF', position: { x: 10, y: 10 }, direction: 'UP', isVulnerable: false, isDead: false },
    { id: '4', type: 'Clyde', color: '#FFB852', position: { x: 9, y: 10 }, direction: 'UP', isVulnerable: false, isDead: false },
  ]);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: 3,
    isGameOver: false,
    isPaused: true,
    isWin: false,
    highScore: 0,
    powerMode: false
  });
  const [aiAdvice, setAiAdvice] = useState("¡Presiona cualquier tecla para empezar!");
  const [lastAdviceTime, setLastAdviceTime] = useState(0);

  const gameLoopRef = useRef<number | null>(null);

  const isWall = (x: number, y: number) => {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return true;
    return map[y][x] === TileType.WALL || map[y][x] === TileType.GATE;
  };

  const getOppositeDirection = (dir: Direction): Direction => {
    switch (dir) {
      case 'UP': return 'DOWN';
      case 'DOWN': return 'UP';
      case 'LEFT': return 'RIGHT';
      case 'RIGHT': return 'LEFT';
      default: return 'STATIONARY';
    }
  };

  const updateAdvice = useCallback(async () => {
    const now = Date.now();
    if (now - lastAdviceTime > 10000) { // Every 10 seconds
      const advice = await getGameAdvice(gameState.score, gameState.powerMode, 1);
      setAiAdvice(advice);
      setLastAdviceTime(now);
    }
  }, [gameState.score, gameState.powerMode, lastAdviceTime]);

  const moveEntity = (pos: Position, dir: Direction): Position => {
    let { x, y } = pos;
    if (dir === 'UP') y--;
    if (dir === 'DOWN') y++;
    if (dir === 'LEFT') x--;
    if (dir === 'RIGHT') x++;

    // Tunneling
    if (x < 0) x = GRID_WIDTH - 1;
    if (x >= GRID_WIDTH) x = 0;

    return { x, y };
  };

  const handleGhostMovement = (ghost: Ghost): Ghost => {
    if (ghost.isDead) {
      // Return to base logic
      if (ghost.position.x === 9 && ghost.position.y === 9) {
        return { ...ghost, isDead: false, isVulnerable: false };
      }
      // Simple pathfinding back to 9,9 could go here
    }

    const possibleDirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const validDirs = possibleDirs.filter(d => {
      const next = moveEntity(ghost.position, d);
      return !isWall(next.x, next.y) && d !== getOppositeDirection(ghost.direction);
    });

    let chosenDir = ghost.direction;
    if (validDirs.length > 0) {
      // If at intersection or can't go straight, pick a random valid direction
      const nextInSameDir = moveEntity(ghost.position, ghost.direction);
      if (validDirs.length > 1 || isWall(nextInSameDir.x, nextInSameDir.y)) {
        chosenDir = validDirs[Math.floor(Math.random() * validDirs.length)];
      }
    } else {
      // Trapped, reverse
      chosenDir = getOppositeDirection(ghost.direction);
    }

    return { ...ghost, position: moveEntity(ghost.position, chosenDir), direction: chosenDir };
  };

  const gameStep = useCallback(() => {
    if (gameState.isGameOver || gameState.isPaused || gameState.isWin) return;

    setPacman(prev => {
      // Try next direction first
      let currentDir = pacmanDir;
      const tryNext = moveEntity(prev, nextDir);
      if (!isWall(tryNext.x, tryNext.y) && nextDir !== 'STATIONARY') {
        currentDir = nextDir;
        setPacmanDir(nextDir);
      }

      const next = moveEntity(prev, currentDir);
      if (isWall(next.x, next.y)) return prev;

      // Handle pickups
      const tile = map[next.y][next.x];
      if (tile === TileType.DOT || tile === TileType.POWER_PELLET) {
        setMap(prevMap => {
          const newMap = prevMap.map(row => [...row]);
          newMap[next.y][next.x] = TileType.EMPTY;
          return newMap;
        });

        setGameState(prevS => {
          let newScore = prevS.score + (tile === TileType.DOT ? 10 : 50);
          let power = prevS.powerMode;
          if (tile === TileType.POWER_PELLET) {
            power = true;
            setTimeout(() => {
              setGameState(s => ({ ...s, powerMode: false }));
              setGhosts(gs => gs.map(g => ({ ...g, isVulnerable: false })));
            }, POWER_DURATION);
            setGhosts(gs => gs.map(g => ({ ...g, isVulnerable: !g.isDead })));
          }
          return { ...prevS, score: newScore, powerMode: power };
        });
      }

      return next;
    });

    setGhosts(prevGhosts => prevGhosts.map(g => handleGhostMovement(g)));

    updateAdvice();
  }, [gameState, pacmanDir, nextDir, map, updateAdvice]);

  // Check Collisions
  useEffect(() => {
    const collision = ghosts.find(g => g.position.x === pacman.x && g.position.y === pacman.y);
    if (collision) {
      if (gameState.powerMode && !collision.isDead) {
        // Eat ghost
        setGhosts(gs => gs.map(g => g.id === collision.id ? { ...g, isDead: true, isVulnerable: false } : g));
        setGameState(s => ({ ...s, score: s.score + 200 }));
      } else if (!collision.isDead) {
        // Lose life
        setGameState(s => ({ ...s, lives: s.lives - 1, isPaused: true }));
        setPacman({ x: 9, y: 16 });
        setPacmanDir('STATIONARY');
        if (gameState.lives <= 1) {
          setGameState(s => ({ ...s, isGameOver: true }));
        }
      }
    }

    // Win check
    const remainingDots = map.flat().some(tile => tile === TileType.DOT);
    if (!remainingDots && !gameState.isWin) {
      setGameState(s => ({ ...s, isWin: true }));
    }
  }, [pacman, ghosts, gameState.powerMode, map, gameState.lives, gameState.isWin]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.isPaused && !gameState.isGameOver && !gameState.isWin) {
        setGameState(s => ({ ...s, isPaused: false }));
      }
      switch (e.key) {
        case 'ArrowUp': setNextDir('UP'); break;
        case 'ArrowDown': setNextDir('DOWN'); break;
        case 'ArrowLeft': setNextDir('LEFT'); break;
        case 'ArrowRight': setNextDir('RIGHT'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.isPaused, gameState.isGameOver, gameState.isWin]);

  useEffect(() => {
    const interval = setInterval(gameStep, GAME_SPEED);
    return () => clearInterval(interval);
  }, [gameStep]);

  const restartGame = () => {
    setMap(INITIAL_MAP.map(row => [...row]));
    setPacman({ x: 9, y: 16 });
    setPacmanDir('STATIONARY');
    setGhosts([
      { id: '1', type: 'Blinky', color: '#FF0000', position: { x: 9, y: 9 }, direction: 'UP', isVulnerable: false, isDead: false },
      { id: '2', type: 'Pinky', color: '#FFB8FF', position: { x: 8, y: 10 }, direction: 'UP', isVulnerable: false, isDead: false },
      { id: '3', type: 'Inky', color: '#00FFFF', position: { x: 10, y: 10 }, direction: 'UP', isVulnerable: false, isDead: false },
      { id: '4', type: 'Clyde', color: '#FFB852', position: { x: 9, y: 10 }, direction: 'UP', isVulnerable: false, isDead: false },
    ]);
    setGameState({
      score: 0,
      lives: 3,
      isGameOver: false,
      isPaused: true,
      isWin: false,
      highScore: gameState.score > gameState.highScore ? gameState.score : gameState.highScore,
      powerMode: false
    });
    setAiAdvice("¡Prepárate! Ronda nueva.");
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      {/* Header UI */}
      <div className="w-full max-w-lg flex justify-between mb-4 text-xs md:text-sm text-white">
        <div>
          <p className="mb-1 text-yellow-400">PUNTOS</p>
          <p>{gameState.score.toString().padStart(6, '0')}</p>
        </div>
        <div>
          <p className="mb-1 text-gray-400">MÁXIMO</p>
          <p>{gameState.highScore.toString().padStart(6, '0')}</p>
        </div>
        <div>
          <p className="mb-1 text-red-400">VIDAS</p>
          <div className="flex gap-1 justify-end">
             {Array.from({ length: gameState.lives }).map((_, i) => (
               <div key={i} className="w-3 h-3 bg-yellow-400 rounded-full" />
             ))}
          </div>
        </div>
      </div>

      {/* Game Board Container */}
      <div className="relative border-4 border-blue-600 rounded-lg p-1 bg-black shadow-[0_0_20px_rgba(37,99,235,0.4)]">
        <div 
          className="grid gap-0" 
          style={{ 
            gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(14px, 1.5rem))`,
            gridTemplateRows: `repeat(${GRID_HEIGHT}, minmax(14px, 1.5rem))`
          }}
        >
          {map.map((row, y) => row.map((tile, x) => (
            <div key={`${x}-${y}`} className="relative flex items-center justify-center">
              {/* Tile Backgrounds */}
              {tile === TileType.WALL && <div className="w-full h-full bg-blue-900/30 border-[0.5px] border-blue-500 rounded-sm" />}
              {tile === TileType.DOT && <div className="w-1.5 h-1.5 bg-yellow-100 rounded-full" />}
              {tile === TileType.POWER_PELLET && <div className="w-3 h-3 bg-yellow-100 rounded-full animate-pulse" />}
              {tile === TileType.GATE && <div className="w-full h-1 bg-pink-400 self-start" />}
              
              {/* Entities */}
              {pacman.x === x && pacman.y === y && (
                <div className={`absolute w-4 h-4 md:w-5 md:h-5 bg-yellow-400 rounded-full z-10 
                  ${pacmanDir === 'LEFT' ? 'rotate-180' : pacmanDir === 'UP' ? '-rotate-90' : pacmanDir === 'DOWN' ? 'rotate-90' : ''}`}
                  style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 35%, 50% 50%, 100% 65%, 100% 100%, 0% 100%)' }}
                />
              )}
              {ghosts.map(ghost => ghost.position.x === x && ghost.position.y === y && (
                <div key={ghost.id} className="absolute z-10 flex flex-col items-center">
                   <div 
                    className={`w-4 h-4 md:w-5 md:h-5 rounded-t-full relative ${ghost.isDead ? 'bg-transparent border-2 border-white' : (gameState.powerMode && !ghost.isDead ? 'bg-blue-600' : '')}`}
                    style={{ backgroundColor: (gameState.powerMode && !ghost.isDead) ? '#1D4ED8' : (ghost.isDead ? 'transparent' : ghost.color) }}
                  >
                    <div className="absolute top-1 left-1 flex gap-1">
                      <div className="w-1 h-1 bg-white rounded-full" />
                      <div className="w-1 h-1 bg-white rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )))}
        </div>

        {/* Overlay Screens */}
        {(gameState.isGameOver || gameState.isWin || (gameState.isPaused && !gameState.isGameOver)) && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20 text-center p-4">
            {gameState.isGameOver && (
              <>
                <h2 className="text-red-600 text-xl md:text-3xl mb-4">GAME OVER</h2>
                <button 
                  onClick={restartGame}
                  className="bg-yellow-400 text-black px-4 py-2 rounded text-xs hover:bg-yellow-300 transition-colors"
                >
                  REINTENTAR
                </button>
              </>
            )}
            {gameState.isWin && (
              <>
                <h2 className="text-yellow-400 text-xl md:text-3xl mb-4">¡GANASTE!</h2>
                <button 
                  onClick={restartGame}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-xs hover:bg-blue-500 transition-colors"
                >
                  OTRA VEZ
                </button>
              </>
            )}
            {gameState.isPaused && !gameState.isGameOver && !gameState.isWin && (
              <p className="text-yellow-400 text-sm md:text-base animate-pulse px-4">
                PULSA UNA FLECHA PARA COMENZAR
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer AI Advice */}
      <div className="mt-8 max-w-lg w-full bg-gray-900/50 p-4 border border-gray-800 rounded-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold">AI</div>
          <span className="text-[10px] text-gray-400">CONSEJO DE GEMINI</span>
        </div>
        <p className="text-[10px] md:text-xs text-blue-200 leading-loose">
          {aiAdvice}
        </p>
      </div>

      {/* Mobile Controls */}
      <div className="md:hidden grid grid-cols-3 gap-2 mt-8">
        <div />
        <button onClick={() => setNextDir('UP')} className="w-12 h-12 bg-gray-800 border-2 border-gray-600 rounded-full flex items-center justify-center text-white text-xl">↑</button>
        <div />
        <button onClick={() => setNextDir('LEFT')} className="w-12 h-12 bg-gray-800 border-2 border-gray-600 rounded-full flex items-center justify-center text-white text-xl">←</button>
        <button onClick={() => setNextDir('DOWN')} className="w-12 h-12 bg-gray-800 border-2 border-gray-600 rounded-full flex items-center justify-center text-white text-xl">↓</button>
        <button onClick={() => setNextDir('RIGHT')} className="w-12 h-12 bg-gray-800 border-2 border-gray-600 rounded-full flex items-center justify-center text-white text-xl">→</button>
      </div>

      <p className="mt-4 text-[8px] text-gray-600">USA LAS FLECHAS DEL TECLADO PARA MOVERTE</p>
    </div>
  );
};

export default App;
