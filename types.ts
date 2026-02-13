
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'STATIONARY';

export interface Position {
  x: number;
  y: number;
}

export interface Entity {
  position: Position;
  direction: Direction;
}

export interface Ghost extends Entity {
  id: string;
  color: string;
  type: 'Blinky' | 'Pinky' | 'Inky' | 'Clyde';
  isVulnerable: boolean;
  isDead: boolean;
}

export enum TileType {
  EMPTY = 0,
  WALL = 1,
  DOT = 2,
  POWER_PELLET = 3,
  GATE = 4
}

export interface GameState {
  score: number;
  lives: number;
  isGameOver: boolean;
  isPaused: boolean;
  isWin: boolean;
  highScore: number;
  powerMode: boolean;
}
