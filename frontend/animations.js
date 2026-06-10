/* ====================================================
   SRI AMMAVARI UTSAVAM - CANVAS ANIMATIONS & AUDIO ENGINE
   ==================================================== */

// Global Animation State
const AnimationEngine = {
  canvas: null,
  ctx: null,
  petals: [],
  fireworks: [],
  maxPetals: 45,
  animationId: null,
  windSpeed: 0.3,
  
  // Web Audio Context for Devotional Bell Synthesis
  audioCtx: null,
  isAudioPlaying: false,
  bellInterval: null,

  init() {
    this.canvas = document.getElementById('animation-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Generate falling marigold & jasmine petals
    this.createPetals();

    // Start animation loop
    this.animate();

    // Initialize Bell Audio Trigger bindings
    this.initAudioBinds();
  },

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  // ----------------------------------------------------
  // DYNAMIC PETALS ENGINE (Canvas Marigold & Jasmine)
  // ----------------------------------------------------
  createPetals() {
    this.petals = [];
    for (let i = 0; i < this.maxPetals; i++) {
      this.petals.push(this.spawnPetal(true)); // Spread vertically initially
    }
  },

  spawnPetal(randomY = false) {
    const types = ['marigold', 'jasmine'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    return {
      x: Math.random() * this.canvas.width,
      y: randomY ? Math.random() * this.canvas.height : -20,
      size: Math.random() * 8 + 6,
      speedY: Math.random() * 1.2 + 0.8,
      speedX: Math.random() * 0.6 - 0.3,
      angle: Math.random() * Math.PI * 2,
      spinSpeed: Math.random() * 0.02 - 0.01,
      type: type,
      opacity: Math.random() * 0.3 + 0.6
    };
  },

  drawPetal(p) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = p.opacity;

    if (p.type === 'marigold') {
      // Draw premium marigold petals (vibrant orange-gold layers)
      ctx.beginPath();
      ctx.fillStyle = '#FF8C00'; // Dark orange outer
      ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = '#FFD700'; // Gold inner layer
      ctx.ellipse(0, 0, p.size * 0.7, p.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tiny center red spec for devotional saffron
      ctx.beginPath();
      ctx.fillStyle = '#D2143A';
      ctx.arc(0, 0, p.size * 0.15, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Draw premium jasmine petals (delicate creamy-white drops)
      ctx.beginPath();
      ctx.fillStyle = '#FFFFF0'; // Cream white
      ctx.ellipse(0, 0, p.size * 0.8, p.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = '#E8F5E9'; // Soft greenish touch at base
      ctx.ellipse(-p.size * 0.3, 0, p.size * 0.3, p.size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  updatePetals() {
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];
      p.y += p.speedY;
      p.x += p.speedX + this.windSpeed;
      p.angle += p.spinSpeed;

      // Wrap-around or respawn conditions
      if (p.y > this.canvas.height + 20 || p.x > this.canvas.width + 20 || p.x < -20) {
        this.petals[i] = this.spawnPetal(false);
      }
    }
  },

  // ----------------------------------------------------
  // DYNAMIC FIREWORKS ENGINE (Canvas Celebrations Burst)
  // ----------------------------------------------------
  triggerFirework(x, y) {
    const particleCount = 100;
    const hue = Math.random() * 360;
    const particles = [];
    
    // Golden sparks, crimson blasts, and saffron bursts
    const colors = [
      '#FFD700', // Gold
      '#FF8C00', // Saffron
      '#FF1493', // Crimson pink
      '#FF3333', // Deep red
      '#00FF7F'  // Light emerald
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 1.5;
      
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 2 + 1,
        color: color,
        opacity: 1,
        fadeSpeed: Math.random() * 0.015 + 0.008,
        gravity: 0.04
      });
    }

    this.fireworks.push({ particles });
  },

  updateFireworks() {
    for (let f = this.fireworks.length - 1; f >= 0; f--) {
      const firework = this.fireworks[f];
      let activeParticles = 0;

      for (let p = 0; p < firework.particles.length; p++) {
        const part = firework.particles[p];
        part.x += part.vx;
        part.y += part.vy;
        part.vy += part.gravity; // Gravity pulling downward
        part.opacity -= part.fadeSpeed;

        if (part.opacity > 0) {
          activeParticles++;
          this.ctx.save();
          this.ctx.globalAlpha = part.opacity;
          this.ctx.beginPath();
          this.ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
          this.ctx.fillStyle = part.color;
          // Sparkle bloom effect
          this.ctx.shadowBlur = 6;
          this.ctx.shadowColor = part.color;
          this.ctx.fill();
          this.ctx.restore();
        }
      }

      // Cleanup finished fireworks
      if (activeParticles === 0) {
        this.fireworks.splice(f, 1);
      }
    }
  },

  // ----------------------------------------------------
  // ENGINE LOOP INTERFACE
  // ----------------------------------------------------
  animate() {
    // Clear canvas with trace transparency for beautiful firework tails
    this.ctx.fillStyle = 'rgba(24, 3, 5, 0.08)'; 
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw active floral wind
    this.petals.forEach(p => {
      this.drawPetal(p);
    });
    this.updatePetals();

    // Draw celebrations fireworks
    this.updateFireworks();

    this.animationId = requestAnimationFrame(() => this.animate());
  },

  // ----------------------------------------------------
  // HTML5 WEB AUDIO API - TEMPLE BELL RESONANCE SYNTH
  // ----------------------------------------------------
  initAudioBinds() {
    const musicBtn = document.getElementById('music-toggle');
    if (!musicBtn) return;

    musicBtn.addEventListener('click', () => {
      if (this.isAudioPlaying) {
        this.stopBells();
      } else {
        this.startBells();
      }
    });
  },

  startBells() {
    const musicBtn = document.getElementById('music-toggle');
    if (!musicBtn) return;

    // Establish AudioContext on user interaction
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.isAudioPlaying = true;
    musicBtn.classList.add('playing');
    
    // Play initial bell
    this.synthesizeBell();

    // Ring temple bells periodically every 6 seconds
    this.bellInterval = setInterval(() => {
      this.synthesizeBell();
    }, 6000);
  },

  stopBells() {
    const musicBtn = document.getElementById('music-toggle');
    if (!musicBtn) return;

    this.isAudioPlaying = false;
    musicBtn.classList.remove('playing');
    
    if (this.bellInterval) {
      clearInterval(this.bellInterval);
      this.bellInterval = null;
    }
  },

  synthesizeBell() {
    if (!this.audioCtx || this.audioCtx.state === 'suspended') return;
    
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    
    // Create master bell gain controller
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.4, now + 0.05); // Rapid strike chime
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.0); // Slow lingering hum
    masterGain.connect(ctx.destination);

    // Dynamic high pass filter to remove harsh thuds
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(80, now);
    filter.connect(masterGain);

    // Ring modulators and fundamental frequencies for authentic brass bell
    // Fundamental, inner hum, bell strike harmonics, high chimes
    const bellFrequencies = [
      220,  // Hum (Fundamental octave)
      440,  // Strike tone (Prime frequency)
      545,  // Tierce harmonic (minor third - provides devotional sweet/melancholy overtone)
      659,  // Quint harmonic (fifth)
      880,  // Nominal chime
      1200, // Superquint
      1760  // Shrill strike edge
    ];

    const volumeWeights = [
      0.8, // Low hum weight
      1.0, // Primary chime strike weight
      0.65, // Sweet overtone
      0.45,
      0.35,
      0.2,
      0.15
    ];

    const decayMultipliers = [
      1.0, // Hum lingers longest
      0.7, // Primary decays naturally
      0.5, // Overtone decays faster
      0.4,
      0.3,
      0.2,
      0.1 // Edge metal decay is instant
    ];

    bellFrequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      
      // Use Sine wave for fundamentals and triangle for metallic chime peaks
      osc.type = i < 3 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      
      // Fine detuning for chorus organic bell ring
      osc.detune.setValueAtTime((Math.random() * 8) - 4, now);

      oscGain.gain.setValueAtTime(volumeWeights[i], now);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + (4.0 * decayMultipliers[i]));

      osc.connect(oscGain);
      oscGain.connect(filter);
      
      osc.start(now);
      osc.stop(now + 5.0);
    });
  }
};

// Initialize canvas animations on startup
document.addEventListener('DOMContentLoaded', () => {
  AnimationEngine.init();
  
  // Bind simple body click fireworks just to make landing interactive and wow the user!
  document.body.addEventListener('click', (e) => {
    // Only fire when clicking non-interactive elements (e.g. backgrounds)
    if (e.target === document.body || e.target.id === 'animation-canvas' || e.target.tagName === 'SECTION') {
      AnimationEngine.triggerFirework(e.clientX, e.clientY);
      
      // Ring small synthesized bell on background tap
      if (AnimationEngine.isAudioPlaying) {
        AnimationEngine.synthesizeBell();
      }
    }
  });
});
