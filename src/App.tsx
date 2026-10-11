import { useEffect, useRef, useState, useCallback } from 'react';

// ===== GAME CONSTANTS =====
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const PIXEL_SIZE = 4;
const BIRD_X = 120;
const BIRD_WIDTH = 40;
const BIRD_HEIGHT = 32;
const GRAVITY = 0.3;
const FLAP_FORCE = -5;
const OBSTACLE_WIDTH = 50;
const WORM_SIZE = 16;
const GROUND_HEIGHT = 40;

// Difficulty settings
interface DifficultyConfig {
  name: string;
  obstacleGap: number;
  obstacleSpeed: number;
  obstacleSpawnRate: number;
  wormSpawnRate: number;
  wormYMin: number;
  wormYMax: number;
}

const DIFFICULTY_EASY: DifficultyConfig = {
  name: 'Легкий',
  obstacleGap: 180,
  obstacleSpeed: 2.0,
  obstacleSpawnRate: 140,
  wormSpawnRate: 70,
  wormYMin: 150,
  wormYMax: 350,
};

const DIFFICULTY_HARD: DifficultyConfig = {
  name: 'Сложный',
  obstacleGap: 140,
  obstacleSpeed: 3.0,
  obstacleSpawnRate: 100,
  wormSpawnRate: 90,
  wormYMin: 120,
  wormYMax: 380,
};

// Colors
const COLORS = {
  bird: '#FFEA00',
  birdDark: '#FFC107',
  birdBeak: '#FF5722',
  birdEye: '#000000',
  birdWing: '#FFD600',
  birdTail: '#FFC107',
  obstacle: '#5D4037',
  obstacleDark: '#3E2723',
  obstacleLeaf: '#2E7D32',
  obstacleLeafLight: '#4CAF50',
  wormGray: '#808080',
  wormGrayDark: '#606060',
  wormGreen: '#4CAF50',
  wormGreenDark: '#2E7D32',
  wormPurple: '#9C27B0',
  wormPurpleDark: '#6A1B9A',
  cloud: '#FFFFFF',
  cloudShadow: '#E0E0E0',
  text: '#FFFFFF',
  ground: '#4a7c3f',
  groundDark: '#3d6634',
  heart: '#FF0000',
  heartEmpty: '#555555',
};

// ===== TYPES =====
interface Bird {
  x: number;
  y: number;
  vy: number;
  frame: number;
  frameTimer: number;
}

interface Obstacle {
  x: number;
  gapY: number;
  passed: boolean;
}

interface Worm {
  x: number;
  y: number;
  type: 'gray' | 'green' | 'purple';
  collected: boolean;
  wiggleTimer: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Cloud {
  x: number;
  y: number;
  width: number;
  speed: number;
}

type GameState = 'menu' | 'playing' | 'gameover';
type Difficulty = 'easy' | 'hard';

// ===== PIXEL DRAWING HELPERS =====
function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.floor(x / PIXEL_SIZE) * PIXEL_SIZE,
    Math.floor(y / PIXEL_SIZE) * PIXEL_SIZE,
    Math.ceil(w / PIXEL_SIZE) * PIXEL_SIZE,
    Math.ceil(h / PIXEL_SIZE) * PIXEL_SIZE
  );
}

// Draw pixel bird (oriole - иволга)
function drawBird(ctx: CanvasRenderingContext2D, bird: Bird, invincible: boolean) {
  const x = Math.floor(bird.x / PIXEL_SIZE) * PIXEL_SIZE;
  const y = Math.floor(bird.y / PIXEL_SIZE) * PIXEL_SIZE;
  const p = PIXEL_SIZE;

  if (invincible && Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  // Glow effect around bird
  ctx.fillStyle = 'rgba(255, 234, 0, 0.15)';
  ctx.fillRect(x - p, y - p, 12 * p, 8 * p);

  // Body (bright yellow)
  drawPixelRect(ctx, x + 2 * p, y + 1 * p, 6 * p, 5 * p, COLORS.bird);
  drawPixelRect(ctx, x + 1 * p, y + 2 * p, 8 * p, 3 * p, COLORS.bird);

  // Head (bright yellow)
  drawPixelRect(ctx, x + 6 * p, y + 0 * p, 3 * p, 3 * p, COLORS.bird);
  drawPixelRect(ctx, x + 5 * p, y + 1 * p, 1 * p, 2 * p, COLORS.bird);

  // Bright highlight on top of body
  ctx.fillStyle = '#FFFF44';
  ctx.fillRect(x + 3 * p, y + 1 * p, 4 * p, p);

  // Darker shade on belly
  drawPixelRect(ctx, x + 2 * p, y + 5 * p, 5 * p, 1 * p, COLORS.birdDark);

  // Wing (animated) - black like real oriole
  const wingOffset = bird.frame % 2 === 0 ? 0 : -p;
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(
    Math.floor((x + 3 * p) / p) * p,
    Math.floor((y + 2 * p + wingOffset) / p) * p,
    4 * p, 2 * p
  );
  ctx.fillRect(
    Math.floor((x + 3 * p) / p) * p,
    Math.floor((y + 1 * p + wingOffset) / p) * p,
    3 * p, 1 * p
  );
  // Yellow wing stripe
  ctx.fillStyle = COLORS.birdWing;
  ctx.fillRect(
    Math.floor((x + 4 * p) / p) * p,
    Math.floor((y + 3 * p + wingOffset) / p) * p,
    2 * p, p
  );

  // Tail (black with yellow tips)
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(x + 0 * p, y + 2 * p, 2 * p, 2 * p);
  ctx.fillRect(x - 1 * p, y + 3 * p, 1 * p, 1 * p);
  // Yellow tail tips
  ctx.fillStyle = COLORS.birdTail;
  ctx.fillRect(x - 1 * p, y + 2 * p, 1 * p, 1 * p);

  // Beak (red-orange, sharp)
  drawPixelRect(ctx, x + 9 * p, y + 1 * p, 2 * p, 1 * p, COLORS.birdBeak);
  drawPixelRect(ctx, x + 9 * p, y + 2 * p, 1 * p, 1 * p, '#E64A19');

  // Eye (big and expressive)
  drawPixelRect(ctx, x + 7 * p, y + 1 * p, 1 * p, 1 * p, COLORS.birdEye);

  // Eye highlight (bigger)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 7 * p + 1, y + 1 * p, p / 2 + 1, p / 2 + 1);

  // Red cheek patch (like real oriole)
  ctx.fillStyle = '#FF3D00';
  ctx.fillRect(x + 8 * p, y + 2 * p, p, p);

  ctx.globalAlpha = 1;
}

// Draw worm
function drawWorm(ctx: CanvasRenderingContext2D, worm: Worm) {
  const x = Math.floor(worm.x / PIXEL_SIZE) * PIXEL_SIZE;
  const y = Math.floor(worm.y / PIXEL_SIZE) * PIXEL_SIZE;
  const p = PIXEL_SIZE;
  const wiggle = Math.sin(worm.wiggleTimer * 0.1) * 2;

  let color1: string, color2: string;
  switch (worm.type) {
    case 'gray':
      color1 = COLORS.wormGray;
      color2 = COLORS.wormGrayDark;
      break;
    case 'green':
      color1 = COLORS.wormGreen;
      color2 = COLORS.wormGreenDark;
      break;
    case 'purple':
      color1 = COLORS.wormPurple;
      color2 = COLORS.wormPurpleDark;
      break;
  }

  // Worm body (wiggly)
  drawPixelRect(ctx, x + 1 * p, y + 1 * p + wiggle, 3 * p, 1 * p, color1);
  drawPixelRect(ctx, x + 0 * p, y + 2 * p, 1 * p, 1 * p, color1);
  drawPixelRect(ctx, x + 4 * p, y + 2 * p - wiggle, 1 * p, 1 * p, color1);
  drawPixelRect(ctx, x + 1 * p, y + 3 * p, 3 * p, 1 * p, color2);

  // Worm head
  drawPixelRect(ctx, x + 4 * p, y + 1 * p - wiggle, 1 * p, 2 * p, color1);
  // Eyes
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + 4 * p + 1, y + 1 * p - wiggle + 1, 2, 2);
}

// Draw obstacle (tree trunk style)
function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, gapSize: number) {
  const x = Math.floor(obs.x / PIXEL_SIZE) * PIXEL_SIZE;
  const p = PIXEL_SIZE;

  // Top obstacle (hanging down)
  for (let ty = 0; ty < obs.gapY; ty += p) {
    drawPixelRect(ctx, x, ty, OBSTACLE_WIDTH, p, COLORS.obstacle);
    if (ty % (p * 4) === 0) {
      drawPixelRect(ctx, x + p, ty, p, p, COLORS.obstacleDark);
      drawPixelRect(ctx, x + OBSTACLE_WIDTH - 2 * p, ty + p, p, p, COLORS.obstacleDark);
    }
  }
  // Top cap with leaves
  drawPixelRect(ctx, x - p, obs.gapY - 2 * p, OBSTACLE_WIDTH + 2 * p, 2 * p, COLORS.obstacleLeaf);
  drawPixelRect(ctx, x - 2 * p, obs.gapY - 3 * p, OBSTACLE_WIDTH + 4 * p, 1 * p, COLORS.obstacleLeafLight);
  drawPixelRect(ctx, x, obs.gapY - 4 * p, 2 * p, 1 * p, COLORS.obstacleLeafLight);
  drawPixelRect(ctx, x + OBSTACLE_WIDTH - 2 * p, obs.gapY - 4 * p, 2 * p, 1 * p, COLORS.obstacleLeafLight);

  // Bottom obstacle (from gap bottom to ground)
  const bottomY = obs.gapY + gapSize;
  for (let ty = bottomY; ty < CANVAS_HEIGHT - GROUND_HEIGHT; ty += p) {
    drawPixelRect(ctx, x, ty, OBSTACLE_WIDTH, p, COLORS.obstacle);
    if (ty % (p * 4) === 0) {
      drawPixelRect(ctx, x + 2 * p, ty, p, p, COLORS.obstacleDark);
      drawPixelRect(ctx, x + OBSTACLE_WIDTH - 3 * p, ty + p, p, p, COLORS.obstacleDark);
    }
  }
  // Bottom cap with leaves
  drawPixelRect(ctx, x - p, bottomY, OBSTACLE_WIDTH + 2 * p, 2 * p, COLORS.obstacleLeaf);
  drawPixelRect(ctx, x - 2 * p, bottomY + 2 * p, OBSTACLE_WIDTH + 4 * p, 1 * p, COLORS.obstacleLeafLight);
  drawPixelRect(ctx, x, bottomY + 3 * p, 2 * p, 1 * p, COLORS.obstacleLeafLight);
  drawPixelRect(ctx, x + OBSTACLE_WIDTH - 2 * p, bottomY + 3 * p, 2 * p, 1 * p, COLORS.obstacleLeafLight);
}

// Draw heart
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, filled: boolean) {
  const p = 3;
  const color = filled ? COLORS.heart : COLORS.heartEmpty;
  const heart = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
  ];
  ctx.fillStyle = color;
  for (let row = 0; row < heart.length; row++) {
    for (let col = 0; col < heart[row].length; col++) {
      if (heart[row][col]) {
        ctx.fillRect(x + col * p, y + row * p, p, p);
      }
    }
  }
}

// Draw cloud
function drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud) {
  const x = Math.floor(cloud.x);
  const y = Math.floor(cloud.y);
  const w = cloud.width;

  ctx.fillStyle = COLORS.cloudShadow;
  ctx.fillRect(x + PIXEL_SIZE, y + w / 3, w, w / 4);

  ctx.fillStyle = COLORS.cloud;
  ctx.fillRect(x, y, w, w / 3);
  ctx.fillRect(x + w / 4, y - w / 6, w / 2, w / 4);
  ctx.fillRect(x + w / 6, y + w / 3, w * 2 / 3, w / 6);
}

// ===== MAIN GAME COMPONENT =====
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [highScore, setHighScore] = useState(0);

  const gameRef = useRef({
    bird: { x: BIRD_X, y: CANVAS_HEIGHT / 2, vy: 0, frame: 0, frameTimer: 0 } as Bird,
    obstacles: [] as Obstacle[],
    worms: [] as Worm[],
    particles: [] as Particle[],
    clouds: [] as Cloud[],
    keys: { up: false, down: false } as { up: boolean; down: boolean },
    score: 0,
    lives: 3,
    gameState: 'menu' as GameState,
    difficulty: 'easy' as Difficulty,
    obstacleTimer: 0,
    wormTimer: 0,
    invincibleTimer: 0,
    groundOffset: 0,
    lastTime: 0,
  });

  const getDifficultyConfig = useCallback((): DifficultyConfig => {
    return gameRef.current.difficulty === 'easy' ? DIFFICULTY_EASY : DIFFICULTY_HARD;
  }, []);

  const resetGame = useCallback(() => {
    const g = gameRef.current;
    g.bird = { x: BIRD_X, y: CANVAS_HEIGHT / 2, vy: 0, frame: 0, frameTimer: 0 };
    g.obstacles = [];
    g.worms = [];
    g.particles = [];
    g.score = 0;
    g.lives = 3;
    g.obstacleTimer = 0;
    g.wormTimer = 0;
    g.invincibleTimer = 0;
    g.groundOffset = 0;
  }, []);

  const startGame = useCallback((selectedDifficulty: Difficulty) => {
    resetGame();
    gameRef.current.difficulty = selectedDifficulty;
    gameRef.current.gameState = 'playing';
    setDifficulty(selectedDifficulty);
    setGameState('playing');
  }, [resetGame]);

  const spawnParticles = useCallback((x: number, y: number, color: string, count: number) => {
    const g = gameRef.current;
    for (let i = 0; i < count; i++) {
      g.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color,
        size: PIXEL_SIZE * (1 + Math.random()),
      });
    }
  }, []);

  // Initialize clouds
  useEffect(() => {
    const g = gameRef.current;
    g.clouds = [];
    for (let i = 0; i < 5; i++) {
      g.clouds.push({
        x: Math.random() * CANVAS_WIDTH,
        y: 20 + Math.random() * 100,
        width: 40 + Math.random() * 40,
        speed: 0.3 + Math.random() * 0.5,
      });
    }
  }, []);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        g.keys.up = true;
        e.preventDefault();
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        g.keys.down = true;
        e.preventDefault();
      }
      if (e.key === ' ' || e.key === 'Enter') {
        if (g.gameState === 'menu' || g.gameState === 'gameover') {
          startGame(g.difficulty);
        }
        e.preventDefault();
      }
      if (g.gameState === 'menu') {
        if (e.key === '1') {
          g.difficulty = 'easy';
        }
        if (e.key === '2') {
          g.difficulty = 'hard';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        g.keys.up = false;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        g.keys.down = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startGame]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const gameLoop = (timestamp: number) => {
      if (!running) return;

      const g = gameRef.current;
      const config = g.difficulty === 'easy' ? DIFFICULTY_EASY : DIFFICULTY_HARD;

      // Delta time
      if (g.lastTime === 0) g.lastTime = timestamp;
      const dt = Math.min((timestamp - g.lastTime) / 16.67, 3);
      g.lastTime = timestamp;

      // ===== UPDATE =====
      if (g.gameState === 'playing') {
        // Bird physics - up key makes bird go up, down key makes bird go down
        if (g.keys.up) {
          g.bird.vy += FLAP_FORCE * 0.15 * dt;
        }
        if (g.keys.down) {
          g.bird.vy += 2 * dt;
        }
        // Slight gravity always
        g.bird.vy += GRAVITY * 0.3 * dt;
        g.bird.vy = Math.max(-6, Math.min(6, g.bird.vy));
        g.bird.y += g.bird.vy * dt;

        // Bird animation
        g.bird.frameTimer += dt;
        if (g.bird.frameTimer > 5) {
          g.bird.frame++;
          g.bird.frameTimer = 0;
        }

        // Clamp bird position
        if (g.bird.y < 0) {
          g.bird.y = 0;
          g.bird.vy = 0;
        }
        if (g.bird.y > CANVAS_HEIGHT - GROUND_HEIGHT - BIRD_HEIGHT) {
          g.bird.y = CANVAS_HEIGHT - GROUND_HEIGHT - BIRD_HEIGHT;
          g.bird.vy = 0;
        }

        // Ground scroll
        g.groundOffset = (g.groundOffset + config.obstacleSpeed * dt) % (PIXEL_SIZE * 4);

        // Spawn obstacles
        g.obstacleTimer += dt;
        if (g.obstacleTimer > config.obstacleSpawnRate) {
          g.obstacleTimer = 0;
          const gapY = 60 + Math.random() * (CANVAS_HEIGHT - GROUND_HEIGHT - config.obstacleGap - 120);
          g.obstacles.push({
            x: CANVAS_WIDTH + 20,
            gapY,
            passed: false,
          });
        }

        // Spawn worms (closer to center)
        g.wormTimer += dt;
        if (g.wormTimer > config.wormSpawnRate + Math.random() * 40) {
          g.wormTimer = 0;
          const r = Math.random();
          let type: 'gray' | 'green' | 'purple' = 'gray';
          if (r > 0.85) type = 'purple';
          else if (r > 0.5) type = 'green';

          // Spawn worms closer to center
          const wormY = config.wormYMin + Math.random() * (config.wormYMax - config.wormYMin);

          g.worms.push({
            x: CANVAS_WIDTH + 20,
            y: wormY,
            type,
            collected: false,
            wiggleTimer: Math.random() * 100,
          });
        }

        // Move obstacles
        for (const obs of g.obstacles) {
          obs.x -= config.obstacleSpeed * dt;
        }

        // Move worms
        for (const worm of g.worms) {
          worm.x -= config.obstacleSpeed * dt;
          worm.wiggleTimer += dt;
        }

        // Invincibility timer
        if (g.invincibleTimer > 0) {
          g.invincibleTimer -= dt;
        }

        // Collision detection - obstacles
        const birdBox = {
          x: g.bird.x + 8,
          y: g.bird.y + 4,
          w: BIRD_WIDTH - 16,
          h: BIRD_HEIGHT - 8,
        };

        if (g.invincibleTimer <= 0) {
          for (const obs of g.obstacles) {
            const topBox = { x: obs.x, y: 0, w: OBSTACLE_WIDTH, h: obs.gapY };
            const bottomBox = {
              x: obs.x,
              y: obs.gapY + config.obstacleGap,
              w: OBSTACLE_WIDTH,
              h: CANVAS_HEIGHT - obs.gapY - config.obstacleGap,
            };

            if (
              (birdBox.x < topBox.x + topBox.w &&
                birdBox.x + birdBox.w > topBox.x &&
                birdBox.y < topBox.y + topBox.h &&
                birdBox.y + birdBox.h > topBox.y) ||
              (birdBox.x < bottomBox.x + bottomBox.w &&
                birdBox.x + birdBox.w > bottomBox.x &&
                birdBox.y < bottomBox.y + bottomBox.h &&
                birdBox.y + birdBox.h > bottomBox.y)
            ) {
              g.lives--;
              g.invincibleTimer = 90;
              spawnParticles(g.bird.x + BIRD_WIDTH / 2, g.bird.y + BIRD_HEIGHT / 2, '#FF0000', 10);

              if (g.lives <= 0) {
                g.gameState = 'gameover';
                setGameState('gameover');
                if (g.score > highScore) {
                  setHighScore(g.score);
                }
              }
              break;
            }
          }
        }

        // Collision detection - worms
        for (const worm of g.worms) {
          if (worm.collected) continue;
          const wormBox = { x: worm.x, y: worm.y, w: WORM_SIZE, h: WORM_SIZE };
          if (
            birdBox.x < wormBox.x + wormBox.w &&
            birdBox.x + birdBox.w > wormBox.x &&
            birdBox.y < wormBox.y + wormBox.h &&
            birdBox.y + birdBox.h > wormBox.y
          ) {
            worm.collected = true;
            let points = 0;
            let color = '';
            switch (worm.type) {
              case 'gray':
                points = 2;
                color = COLORS.wormGray;
                break;
              case 'green':
                points = 3;
                color = COLORS.wormGreen;
                break;
              case 'purple':
                points = 5;
                color = COLORS.wormPurple;
                break;
            }
            g.score += points;
            spawnParticles(worm.x + WORM_SIZE / 2, worm.y + WORM_SIZE / 2, color, 8);
          }
        }

        // Remove off-screen obstacles and worms
        g.obstacles = g.obstacles.filter((o: Obstacle) => o.x > -OBSTACLE_WIDTH - 20);
        g.worms = g.worms.filter((w: Worm) => w.x > -WORM_SIZE - 20 && !w.collected);
      }

      // Update particles (always)
      for (const part of g.particles) {
        part.x += part.vx;
        part.y += part.vy;
        part.vy += 0.1;
        part.life--;
      }
      g.particles = g.particles.filter((part: Particle) => part.life > 0);

      // Update clouds
      for (const cloud of g.clouds) {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.width < 0) {
          cloud.x = CANVAS_WIDTH + 20;
          cloud.y = 20 + Math.random() * 100;
        }
      }

      // ===== RENDER =====
      // Sky gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, '#4FC3F7');
      gradient.addColorStop(0.7, '#81D4FA');
      gradient.addColorStop(1, '#B3E5FC');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Clouds
      for (const cloud of g.clouds) {
        drawCloud(ctx, cloud);
      }

      // Ground
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
      ctx.fillStyle = COLORS.groundDark;
      ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, PIXEL_SIZE * 2);

      // Ground pattern
      ctx.fillStyle = '#5a8f4a';
      for (let gx = -g.groundOffset; gx < CANVAS_WIDTH; gx += PIXEL_SIZE * 8) {
        ctx.fillRect(gx, CANVAS_HEIGHT - GROUND_HEIGHT + PIXEL_SIZE * 3, PIXEL_SIZE * 4, PIXEL_SIZE);
        ctx.fillRect(gx + PIXEL_SIZE * 4, CANVAS_HEIGHT - GROUND_HEIGHT + PIXEL_SIZE * 6, PIXEL_SIZE * 3, PIXEL_SIZE);
      }

      // Obstacles
      const currentConfig = g.difficulty === 'easy' ? DIFFICULTY_EASY : DIFFICULTY_HARD;
      for (const obs of g.obstacles) {
        drawObstacle(ctx, obs, currentConfig.obstacleGap);
      }

      // Worms
      for (const worm of g.worms) {
        if (!worm.collected) {
          drawWorm(ctx, worm);
        }
      }

      // Bird
      drawBird(ctx, g.bird, g.invincibleTimer > 0);

      // Particles
      for (const part of g.particles) {
        ctx.globalAlpha = part.life / part.maxLife;
        ctx.fillStyle = part.color;
        ctx.fillRect(Math.floor(part.x), Math.floor(part.y), part.size, part.size);
      }
      ctx.globalAlpha = 1;

      // UI - Score
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.textAlign = 'left';

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(10, 10, 160, 35);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(`Очки: ${g.score}`, 18, 33);

      // Lives
      for (let i = 0; i < 3; i++) {
        drawHeart(ctx, CANVAS_WIDTH - 100 + i * 30, 15, i < g.lives);
      }

      // High score
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(10, 50, 160, 25);
      ctx.font = '14px "Courier New", monospace';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`Рекорд: ${Math.max(highScore, g.score)}`, 18, 67);

      // Menu screen
      if (g.gameState === 'menu') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.textAlign = 'center';
        ctx.font = 'bold 48px "Courier New", monospace';
        ctx.fillStyle = '#000000';
        ctx.fillText('ORiolis', CANVAS_WIDTH / 2 + 3, CANVAS_HEIGHT / 4 + 3);
        ctx.fillStyle = '#FFD700';
        ctx.fillText('ORiolis', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 4);

        ctx.font = '18px "Courier New", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Приключения иволги', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 4 + 40);

        // Difficulty selection
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Выбери сложность:', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

        // Easy option
        const easySelected = g.difficulty === 'easy';
        ctx.fillStyle = easySelected ? '#4CAF50' : '#666666';
        ctx.fillRect(CANVAS_WIDTH / 2 - 120, CANVAS_HEIGHT / 2 - 20, 240, 40);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillText('1 - Легкий', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 5);

        // Hard option
        const hardSelected = g.difficulty === 'hard';
        ctx.fillStyle = hardSelected ? '#F44336' : '#666666';
        ctx.fillRect(CANVAS_WIDTH / 2 - 120, CANVAS_HEIGHT / 2 + 30, 240, 40);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('2 - Сложный', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 55);

        // Instructions
        ctx.font = '14px "Courier New", monospace';
        ctx.fillStyle = '#B0BEC5';
        ctx.fillText('↑/W - вверх  |  ↓/S - вниз', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);
        ctx.fillText('Собирай червячков и избегай препятствий!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 125);

        // Worm legend
        ctx.font = '13px "Courier New", monospace';
        ctx.fillStyle = COLORS.wormGray;
        ctx.fillText('● Серый = 2 очка', CANVAS_WIDTH / 2 - 150, CANVAS_HEIGHT / 2 + 155);
        ctx.fillStyle = COLORS.wormGreen;
        ctx.fillText('● Зелёный = 3 очка', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 155);
        ctx.fillStyle = COLORS.wormPurple;
        ctx.fillText('● Фиолетовый = 5 очков', CANVAS_WIDTH / 2 + 150, CANVAS_HEIGHT / 2 + 155);

        // Start prompt
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillStyle = '#FFFFFF';
        const blink = Math.sin(Date.now() / 300) > 0;
        if (blink) {
          ctx.fillText('Нажми ПРОБЕЛ или ENTER для старта', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60);
        }
      }

      // Game over screen
      if (g.gameState === 'gameover') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.textAlign = 'center';
        ctx.font = 'bold 42px "Courier New", monospace';
        ctx.fillStyle = '#FF5252';
        ctx.fillText('ИГРА ОКОНЧЕНА', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3);

        ctx.font = 'bold 24px "Courier New", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`Очки: ${g.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

        ctx.font = '18px "Courier New", monospace';
        ctx.fillStyle = '#B0BEC5';
        ctx.fillText(`Сложность: ${g.difficulty === 'easy' ? 'Легкий' : 'Сложный'}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);

        if (g.score >= highScore && g.score > 0) {
          ctx.fillStyle = '#FFD700';
          ctx.font = 'bold 20px "Courier New", monospace';
          ctx.fillText('Новый рекорд!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
        }

        ctx.font = '16px "Courier New", monospace';
        ctx.fillStyle = '#B0BEC5';
        const blink = Math.sin(Date.now() / 300) > 0;
        if (blink) {
          ctx.fillText('Нажми ПРОБЕЛ или ENTER для рестарта', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 80);
        }
      }

      requestAnimationFrame(gameLoop);
    };

    requestAnimationFrame(gameLoop);

    return () => {
      running = false;
    };
  }, [highScore, spawnParticles]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border-4 border-yellow-600 rounded-lg shadow-2xl"
          style={{ imageRendering: 'pixelated' }}
          onClick={() => {
            if (gameState === 'menu' || gameState === 'gameover') {
              startGame(difficulty);
            }
          }}
        />
      </div>
      <div className="mt-4 text-center">
        <p className="text-gray-400 text-sm font-mono">
          Управление: <span className="text-yellow-400">↑/W</span> вверх | <span className="text-yellow-400">↓/S</span> вниз | <span className="text-yellow-400">1/2</span> выбор сложности | <span className="text-yellow-400">ПРОБЕЛ</span> старт
        </p>
      </div>
    </div>
  );
}
