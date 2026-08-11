// src/utils/breakoutGame.ts

export async function savePlayerScore(score: number, levelReached: number = 1) {
  const userId = localStorage.getItem('breakout_user_id');

  if (!userId) {
    console.warn('⚠️ No hay sesión de operador iniciada. No se guardará la puntuación.');
    return;
  }

  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: Number(userId),
        score: score,
        levelReached: levelReached
      })
    });

    if (res.ok) {
      console.log('✅ Puntuación guardada exitosamente en Turso');
      window.dispatchEvent(new Event('update-leaderboard'));
    } else {
      console.error('❌ Error al guardar puntuación:', await res.json());
    }
  } catch (error) {
    console.error('❌ Error de red al intentar guardar puntuación:', error);
  }
}

export interface BreakoutConfig {
  canvas: HTMLCanvasElement;
  displayScore: HTMLElement | null;
  displayLives: HTMLElement | null;
  displayLevel: HTMLElement | null;
  gameOverScreen: HTMLElement | null;
  levelCompleteScreen: HTMLElement | null;
  gameStatusTitle: HTMLElement | null;
  finalScoreText: HTMLElement | null;
  getPlayerName: () => string;
  onScoreSave: (score: number, levelReached: number) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
}

interface Brick {
  x: number;
  y: number;
  status: number;
  color: string;
  isUnbreakable: boolean;
  hasExtraLife?: boolean;
}

const LEVEL_LAYOUTS = [
  // Nivel 1: Introductorio
  [
    [1, 1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2, 2],
    [3, 3, 3, 3, 3, 3]
  ],
  // Nivel 2: Bloques irrompibles en el centro
  [
    [1, 2, 3, 3, 2, 1],
    [2, 9, 1, 1, 9, 2],
    [3, 2, 9, 9, 2, 3],
    [1, 1, 2, 2, 1, 1]
  ],
  // Nivel 3: Fortaleza de bloques irrompibles
  [
    [9, 1, 9, 9, 1, 9],
    [2, 3, 2, 2, 3, 2],
    [9, 2, 9, 9, 2, 9],
    [3, 1, 3, 3, 1, 3]
  ]
];

export class BreakoutGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private displayScore: HTMLElement | null;
  private displayLives: HTMLElement | null;
  private displayLevel: HTMLElement | null;
  private gameOverScreen: HTMLElement | null;
  private levelCompleteScreen: HTMLElement | null;
  private gameStatusTitle: HTMLElement | null;
  private finalScoreText: HTMLElement | null;
  private getPlayerName: () => string;
  private onScoreSave: (score: number, levelReached: number) => void;

  private score = 0;
  private lives = 3;
  private currentLevel = 0;
  private gameOver = false;
  private isPaused = false;
  private animationFrameId: number | null = null;

  private paddleHeight = 10;
  private paddleWidth = 200;
  private paddleX: number;
  private paddleSpeed = 7; // 🏃 Velocidad de desplazamiento con teclado

  // 🕹️ Controles de teclado
  private rightPressed = false;
  private leftPressed = false;

  private ballRadius = 6;
  private x: number;
  private y: number;
  private dx = 3;
  private dy = -3;

  private brickWidth = 58;
  private brickHeight = 16;
  private brickPadding = 14;
  private brickOffsetTop = 35;
  private brickOffsetLeft = 32;

  private bricks: Brick[][] = [];
  private particles: Particle[] = [];

  constructor(config: BreakoutConfig) {
    this.canvas = config.canvas;
    this.ctx = config.canvas.getContext('2d')!;
    this.displayScore = config.displayScore;
    this.displayLives = config.displayLives;
    this.displayLevel = config.displayLevel;
    this.gameOverScreen = config.gameOverScreen;
    this.levelCompleteScreen = config.levelCompleteScreen;
    this.gameStatusTitle = config.gameStatusTitle;
    this.finalScoreText = config.finalScoreText;
    this.getPlayerName = config.getPlayerName;
    this.onScoreSave = config.onScoreSave;

    this.paddleX = (this.canvas.width - this.paddleWidth) / 2;
    this.x = this.canvas.width / 2;
    this.y = this.canvas.height - 30;

    this.initEvents();
    this.loadLevel(this.currentLevel);
  }

  private initEvents() {
    // Control con Mouse
    document.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      if (relativeX > 0 && relativeX < this.canvas.width) {
        this.paddleX = relativeX - this.paddleWidth / 2;
      }
    });

    // ⌨️ Eventos de Teclado (Presionar)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Right' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.rightPressed = true;
      } else if (e.key === 'Left' || e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.leftPressed = true;
      }
    });

    // ⌨️ Eventos de Teclado (Soltar)
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Right' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.rightPressed = false;
      } else if (e.key === 'Left' || e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.leftPressed = false;
      }
    });
  }

  private loadLevel(levelIndex: number) {
    if (this.displayLevel) {
      this.displayLevel.textContent = (levelIndex + 1).toString();
    }

    const layout = LEVEL_LAYOUTS[levelIndex];
    if (!layout) return;

    this.bricks = [];
    const colorMap: Record<number, string> = {
      1: '#facc15', // Amarillo
      2: '#38bdf8', // Celeste
      3: '#f43f5e', // Rosado
      9: '#000000'  // Negro Irrompible
    };

    const breakablePositions: { c: number; r: number }[] = [];

    for (let r = 0; r < layout.length; r++) {
      for (let c = 0; c < layout[r].length; c++) {
        if (!this.bricks[c]) this.bricks[c] = [];
        const type = layout[r][c];

        if (type !== 0) {
          const isUnbreakable = type === 9;
          this.bricks[c][r] = {
            x: 0,
            y: 0,
            status: 1,
            color: colorMap[type] || '#facc15',
            isUnbreakable,
            hasExtraLife: false
          };

          if (!isUnbreakable) {
            breakablePositions.push({ c, r });
          }
        } else {
          this.bricks[c][r] = { x: 0, y: 0, status: 0, color: '', isUnbreakable: false, hasExtraLife: false };
        }
      }
    }

    // 🎲 Probabilidad del 50% de esconder 1 vida extra en este nivel
    const spawnLifeBlock = Math.random() < 0.5;
    if (spawnLifeBlock && breakablePositions.length > 0) {
      const randomIndex = Math.floor(Math.random() * breakablePositions.length);
      const target = breakablePositions[randomIndex];
      this.bricks[target.c][target.r].hasExtraLife = true;
    }
  }

  private createExplosion(x: number, y: number, customColors?: string[]) {
    const count = 35;
    const colors = customColors || ['#f43f5e', '#facc15', '#38bdf8', '#ffffff'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1
      });
    }
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private drawParticles() {
    this.particles.forEach((p) => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  private collisionDetection() {
    let remainingBreakable = 0;

    for (let c = 0; c < this.bricks.length; c++) {
      for (let r = 0; r < this.bricks[c].length; r++) {
        const b = this.bricks[c][r];
        if (b && b.status === 1) {
          if (!b.isUnbreakable) {
            remainingBreakable++;
          }

          if (
            this.x > b.x &&
            this.x < b.x + this.brickWidth &&
            this.y > b.y &&
            this.y < b.y + this.brickHeight
          ) {
            this.dy = -this.dy;

            if (!b.isUnbreakable) {
              b.status = 0;
              this.score += 10;

              if (b.hasExtraLife) {
                this.lives++;
                if (this.displayLives) this.displayLives.textContent = this.lives.toString();
                this.createExplosion(b.x + this.brickWidth / 2, b.y + this.brickHeight / 2, ['#22c55e', '#facc15', '#0284c7', '#ef4444']);
              }

              if (this.displayScore) this.displayScore.textContent = this.score.toString();
              remainingBreakable--;
            }
          }
        }
      }
    }

    if (remainingBreakable === 0) {
      if (this.currentLevel + 1 < LEVEL_LAYOUTS.length) {
        this.isPaused = true;
        if (this.animationFrameId !== null) {
          cancelAnimationFrame(this.animationFrameId);
        }
        this.levelCompleteScreen?.classList.remove('hidden');
      } else {
        this.handleGameOver(true);
      }
    }
  }

  private handleGameOver(isWin: boolean) {
    this.gameOver = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.gameStatusTitle) {
      this.gameStatusTitle.textContent = isWin ? '¡VICTORIA ABSOLUTA!' : 'LE FALLASTE A LA PATRIA';
      this.gameStatusTitle.className = isWin
        ? 'text-3xl font-black text-yellow-400 font-mono'
        : 'text-3xl font-black text-red-500 font-mono';
    }

    if (this.finalScoreText) {
      this.finalScoreText.textContent = this.score.toString();
    }

    this.gameOverScreen?.classList.remove('hidden');
    this.onScoreSave(this.score, this.currentLevel + 1);
  }

  private resetBallAndPaddle() {
    this.x = this.canvas.width / 2;
    this.y = this.canvas.height - 30;
    this.dx = 3 * (Math.random() > 0.5 ? 1 : -1);
    this.dy = -3;
    this.paddleX = (this.canvas.width - this.paddleWidth) / 2;
  }

  private drawBall() {
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.ballRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#facc15';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#facc15';
    this.ctx.fill();
    this.ctx.closePath();
    this.ctx.shadowBlur = 0;
  }

  private drawPaddle() {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.roundRect(this.paddleX, this.canvas.height - this.paddleHeight - 5, this.paddleWidth, this.paddleHeight, 4);
    this.ctx.clip();

    this.ctx.fillStyle = '#facc15';
    this.ctx.fillRect(this.paddleX, this.canvas.height - this.paddleHeight - 5, this.paddleWidth, this.paddleHeight);

    this.ctx.fillStyle = '#000000';
    const stripeWidth = 8;
    for (let i = -this.paddleHeight; i < this.paddleWidth + this.paddleHeight; i += stripeWidth * 2) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.paddleX + i, this.canvas.height - 5);
      this.ctx.lineTo(this.paddleX + i + stripeWidth, this.canvas.height - 5);
      this.ctx.lineTo(this.paddleX + i + stripeWidth + 6, this.canvas.height - this.paddleHeight - 5);
      this.ctx.lineTo(this.paddleX + i + 6, this.canvas.height - this.paddleHeight - 5);
      this.ctx.fill();
    }
    this.ctx.restore();

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.roundRect(this.paddleX, this.canvas.height - this.paddleHeight - 5, this.paddleWidth, this.paddleHeight, 4);
    this.ctx.strokeStyle = '#facc15';
    this.ctx.lineWidth = 1;
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = '#facc15';
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawBricks() {
    for (let c = 0; c < this.bricks.length; c++) {
      for (let r = 0; r < this.bricks[c].length; r++) {
        const b = this.bricks[c][r];
        if (b && b.status === 1) {
          const brickX = c * (this.brickWidth + this.brickPadding) + this.brickOffsetLeft;
          const brickY = r * (this.brickHeight + this.brickPadding) + this.brickOffsetTop;
          b.x = brickX;
          b.y = brickY;

          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.roundRect(brickX, brickY, this.brickWidth, this.brickHeight, 3);
          this.ctx.clip();

          if (b.hasExtraLife) {
            const h = this.brickHeight / 3;
            
            this.ctx.fillStyle = '#facc15';
            this.ctx.fillRect(brickX, brickY, this.brickWidth, h);

            this.ctx.fillStyle = '#0284c7';
            this.ctx.fillRect(brickX, brickY + h, this.brickWidth, h);

            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillRect(brickX, brickY + h * 2, this.brickWidth, h);

            this.ctx.restore();

            this.ctx.beginPath();
            this.ctx.roundRect(brickX, brickY, this.brickWidth, this.brickHeight, 3);
            this.ctx.strokeStyle = '#22c55e';
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#22c55e';
            this.ctx.stroke();
            this.ctx.closePath();
            this.ctx.shadowBlur = 0;

          } else {
            this.ctx.fillStyle = b.color;
            this.ctx.fill();

            if (b.isUnbreakable) {
              this.ctx.strokeStyle = '#f43f5e';
              this.ctx.lineWidth = 2;
              this.ctx.shadowBlur = 8;
              this.ctx.shadowColor = '#f43f5e';
            } else {
              this.ctx.strokeStyle = '#000000';
              this.ctx.lineWidth = 1.5;
              this.ctx.shadowBlur = 6;
              this.ctx.shadowColor = b.color;
            }

            this.ctx.stroke();
            this.ctx.closePath();
            this.ctx.restore();
            this.ctx.shadowBlur = 0;
          }
        }
      }
    }
  }

  public nextLevel = () => {
    this.levelCompleteScreen?.classList.add('hidden');
    this.currentLevel++;
    this.loadLevel(this.currentLevel);
    this.resetBallAndPaddle();
    this.isPaused = false;
    this.draw();
  };

  public draw = () => {
    if (this.gameOver || this.isPaused) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 🕹️ Desplazamiento por Teclado
    if (this.rightPressed && this.paddleX < this.canvas.width - this.paddleWidth) {
      this.paddleX += this.paddleSpeed;
    } else if (this.leftPressed && this.paddleX > 0) {
      this.paddleX -= this.paddleSpeed;
    }

    this.drawBricks();
    this.drawBall();
    this.drawPaddle();
    this.drawParticles();
    this.updateParticles();
    this.collisionDetection();

    // Rebote paredes laterales
    if (this.x + this.dx > this.canvas.width - this.ballRadius || this.x + this.dx < this.ballRadius) {
      this.dx = -this.dx;
    }

    // Rebote pared superior
    if (this.y + this.dy < this.ballRadius) {
      this.dy = -this.dy;
    } else if (this.y + this.dy > this.canvas.height - this.ballRadius - 10) {
      // Rebote en la raqueta
      if (this.x > this.paddleX && this.x < this.paddleX + this.paddleWidth) {
        this.dy = -this.dy;
      } else {
        this.createExplosion(this.x, this.canvas.height - 5);

        this.lives--;
        if (this.displayLives) this.displayLives.textContent = this.lives.toString();

        if (this.lives <= 0) {
          this.handleGameOver(false);
          return;
        } else {
          this.resetBallAndPaddle();
        }
      }
    }

    this.x += this.dx;
    this.y += this.dy;

    this.animationFrameId = requestAnimationFrame(this.draw);
  };

  public reset = () => {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.score = 0;
    this.lives = 3;
    this.currentLevel = 0;
    this.gameOver = false;
    this.isPaused = false;
    this.rightPressed = false;
    this.leftPressed = false;
    this.particles = [];

    if (this.displayScore) this.displayScore.textContent = '0';
    if (this.displayLives) this.displayLives.textContent = '3';
    if (this.displayLevel) this.displayLevel.textContent = '1';
    
    this.gameOverScreen?.classList.add('hidden');
    this.levelCompleteScreen?.classList.add('hidden');

    this.resetBallAndPaddle();
    this.loadLevel(this.currentLevel);
    this.draw();
  };
}