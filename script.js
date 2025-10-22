const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let player, items, bombs, gravity, score, gameOver, cameraX;

let worldSpeed = 5; // This metric controls the speed of the game
let paused = false;
let dobbyImage = null;
let dobbyImageLoaded = false;
let selectedChar = "bird";
let bgTheme = "sky";
let backgroundElements = {
  clouds: [],
  stars: [],
  moon: null,
  sun: null,
  fish: [],
  seaAnimals: []
};

const sounds = {
  collect: new AudioContext(),
  hit: new AudioContext(),
  jump: new AudioContext()
};

// This block of code defines the Music system
let musicContext = null; // kept for compatibility with other tones
let musicGain = null;
let currentMusic = null;
let musicVolume = 0.3;
let musicPlaying = false;
let bgAudio = null; // HTMLAudioElement for MP3 loop
let isMuted = false;
let animationFrameId = null; // This track the active animation frame to prevent duplicate loops

function playTone(ctx, freq, type = "sine", time = 0.1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time);
  osc.stop(ctx.currentTime + time);
}

// The Music system functions
function initMusic() {
  if (!bgAudio) {
    bgAudio = new Audio('game_music_loop.mp3');
    bgAudio.loop = true;
    bgAudio.volume = musicVolume;
  }
}

function startBackgroundMusic() {
  if (!musicPlaying) {
    initMusic();
    // Start MP3 loop
    bgAudio.currentTime = 0;
    if (!isMuted) {
      bgAudio.play();
    }
    musicPlaying = true;
  }
}

function stopBackgroundMusic() {
  if (bgAudio) {
    bgAudio.pause();
  }
  musicPlaying = false;
}

function playThemeMusic(_theme) {
  
  startBackgroundMusic();
}

function playSkyMusic() {
  const melody = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]; // C major scale
  playMelody(melody, 0.8, "triangle");
}

function playForestMusic() {
  const melody = [220.00, 246.94, 277.18, 311.13, 349.23, 392.00, 440.00, 493.88]; // A minor scale
  playMelody(melody, 1.2, "sawtooth");
}

function playSpaceMusic() {
  const melody = [329.63, 369.99, 415.30, 466.16, 523.25, 587.33, 659.25, 698.46]; // E minor scale
  playMelody(melody, 1.5, "sine");
}

function playOceanMusic() {
  const melody = [196.00, 220.00, 246.94, 277.18, 311.13, 349.23, 392.00, 440.00]; // G major scale
  playMelody(melody, 1.0, "triangle");
}

function playMelody(notes, speed, waveType) {
  if (!musicContext) return;
  
  let noteIndex = 0;
  const playNextNote = () => {
    if (!musicPlaying) return;
    
    const note = notes[noteIndex % notes.length];
    
    // Play main melody
    const osc = musicContext.createOscillator();
    const gain = musicContext.createGain();
    
    osc.type = waveType;
    osc.frequency.value = note;
    osc.connect(gain);
    gain.connect(musicGain);
    
    // Create a gentle attack and release
    gain.gain.setValueAtTime(0, musicContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, musicContext.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, musicContext.currentTime + 0.8);
    
    osc.start(musicContext.currentTime);
    osc.stop(musicContext.currentTime + 0.8);
    
    // Add harmony (octave lower)
    if (noteIndex % 2 === 0) {
      const harmonyOsc = musicContext.createOscillator();
      const harmonyGain = musicContext.createGain();
      
      harmonyOsc.type = waveType;
      harmonyOsc.frequency.value = note * 0.5; // One octave lower
      harmonyOsc.connect(harmonyGain);
      harmonyGain.connect(musicGain);
      
      harmonyGain.gain.setValueAtTime(0, musicContext.currentTime);
      harmonyGain.gain.linearRampToValueAtTime(0.04, musicContext.currentTime + 0.1);
      harmonyGain.gain.linearRampToValueAtTime(0, musicContext.currentTime + 0.8);
      
      harmonyOsc.start(musicContext.currentTime);
      harmonyOsc.stop(musicContext.currentTime + 0.8);
    }
    
    noteIndex++;
    
    // Schedule next note
    setTimeout(playNextNote, speed * 1000);
  };
  
  playNextNote();
}

function startGame() {
  document.getElementById("menu").classList.remove("active");
  document.getElementById("game").classList.add("active");
  initGame();
  startBackgroundMusic();
  
  // This syncs mute button text with current state
  const muteBtn = document.getElementById("muteBtn");
  if (muteBtn) {
    muteBtn.textContent = isMuted ? "Unmute" : "Mute";
  }
}

function initGame() {
  gravity = 0.4;
  score = 0;
  gameOver = false;
  cameraX = 0;
  worldSpeed = 5;
  paused = false;
  // This ensures no previous loop continues running
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  player = {
    x: 100,
    y: canvas.height / 2, // This Starts the player character at the middle of screen
    vy: 0,
    size: 30,
    type: selectedChar,
  };
  // Lazy-load dobby image once
  if (!dobbyImage) {
    dobbyImage = new Image();
    dobbyImage.onload = () => { dobbyImageLoaded = true; };
    dobbyImage.src = "dobby.png";
  }
  // Create static world objects that already exist
  createWorldObjects();
  createBackgroundElements();
  loop();
}

function createWorldObjects() {
  items = [];
  bombs = [];
  
  // Create MANY more stars and bombs - very dense placement
  // Spread them across the full vertical space including bottom areas
  for (let i = 0; i < 800; i++) {
    const x = 200 + i * 40 + Math.random() * 30; // Very close spacing
    const y = 50 + Math.random() * (canvas.height * 4); // Full range including bottom
    items.push({ x: x, y: y, size: 20, collected: false });
  }
  
  for (let i = 0; i < 600; i++) {
    const x = 250 + i * 50 + Math.random() * 40; // Very close spacing
    const y = 50 + Math.random() * (canvas.height * 4); // Full range including bottom
    bombs.push({ x: x, y: y, size: 25, hit: false });
  }
}

function createBackgroundElements() {
  // Clear existing background elements
  backgroundElements.clouds = [];
  
  backgroundElements.stars = [];
  backgroundElements.fish = [];
  backgroundElements.seaAnimals = [];
  backgroundElements.sun = null;
  
  // Create clouds for sky theme
  for (let i = 0; i < 15; i++) {
    backgroundElements.clouds.push({
      x: Math.random() * canvas.width * 2,
      y: Math.random() * canvas.height * 0.6,
      size: 20 + Math.random() * 30,
      speed: 0.5 + Math.random() * 1
    });
  }
  
  
  // Create stars for space theme
  for (let i = 0; i < 100; i++) {
    backgroundElements.stars.push({
      x: Math.random() * canvas.width * 2,
      y: Math.random() * canvas.height,
      size: 1 + Math.random() * 3,
      twinkle: Math.random() * Math.PI * 2
    });
  }
  
  // Create moon for space theme
  backgroundElements.moon = {
    x: canvas.width * 0.8,
    y: canvas.height * 0.2,
    size: 60,
    phase: 0
  };
  
  // Create sun  for sky theme
  if (bgTheme === "sky") {
    backgroundElements.sun = {
      x: canvas.width * 0.2,
      y: canvas.height * 0.15,
      size: 80,
      rotation: 0
    };
  }
  
  // Create fish for ocean theme 
  for (let i = 0; i < 8; i++) {
    backgroundElements.fish.push({
      x: Math.random() * canvas.width * 2,
      y: canvas.height * 0.3 + Math.random() * canvas.height * 0.4,
      size: 15 + Math.random() * 20,
      speed: 1 + Math.random() * 2,
      direction: Math.random() > 0.5 ? 1 : -1,
      swim: Math.random() * Math.PI * 2
    });
  }
  
  // Create sea animals for ocean theme 
  for (let i = 0; i < 4; i++) {
    backgroundElements.seaAnimals.push({
      x: Math.random() * canvas.width * 2,
      y: canvas.height * 0.4 + Math.random() * canvas.height * 0.3,
      size: 25 + Math.random() * 30,
      speed: 0.5 + Math.random() * 1,
      direction: Math.random() > 0.5 ? 1 : -1,
      bob: Math.random() * Math.PI * 2
    });
  }
}

// This creates the player character

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.vy * 0.05);

  // replaces the rocket character with the dobby image
  if (player.type === "rocket" && dobbyImageLoaded) {
    const size = 48; 
    ctx.drawImage(dobbyImage, -size / 2, -size / 2, size, size);
  } else {
    
    ctx.font = "48px serif";
    let emoji = "🐦";
    if (player.type === "fish") emoji = "🐠";
    if (player.type === "rocket") emoji = "🚀";
    // Flip bird and fish to face the other way
    if (player.type === "bird" || player.type === "fish") {
      ctx.scale(-1, 1);
    }
    ctx.fillText(emoji, -24, 20);
  }

  ctx.restore();
}

function drawItems() {
  ctx.font = "32px serif";
  for (const i of items) {
    if (!i.collected) {
      const screenX = i.x - cameraX;
      // Only draw if object is visible on screen
      if (screenX > -50 && screenX < canvas.width + 50) {
        ctx.fillText("⭐", screenX, i.y);
      }
    }
  }
}

function drawBombs() {
  ctx.font = "32px serif";
  for (const b of bombs) {
    if (!b.hit) {
      const screenX = b.x - cameraX;
      // Only draw if object is visible on screen
      if (screenX > -50 && screenX < canvas.width + 50) {
        ctx.fillText("💣", screenX, b.y);
      }
    }
  }
}

function drawBackgroundElements() {
  if (bgTheme === "sky") {
    drawClouds();
  } else if (bgTheme === "space") {
    drawSpaceElements();
  } else if (bgTheme === "ocean") {
    drawOceanElements();
  }
}

function drawClouds() {
  ctx.font = "32px serif";
  for (const cloud of backgroundElements.clouds) {
    const screenX = cloud.x - cameraX * 0.3; // Parallax effect
    if (screenX > -100 && screenX < canvas.width + 100) {
      ctx.fillText("☁️", screenX, cloud.y);
    }
  }
  // Draw sun in sky theme 
  if (backgroundElements.sun) {
    ctx.font = "80px serif";
    const sunScreenX = backgroundElements.sun.x - cameraX * 0.05;
    if (sunScreenX > -100 && sunScreenX < canvas.width + 100) {
      ctx.fillText("☀️", sunScreenX, backgroundElements.sun.y);
    }
  }
}



function drawSpaceElements() {
  // Draw stars
  ctx.fillStyle = "white";
  for (const star of backgroundElements.stars) {
    const screenX = star.x - cameraX * 0.1; // Parallax effect
    if (screenX > -10 && screenX < canvas.width + 10) {
      const alpha = 0.5 + 0.5 * Math.sin(star.twinkle);
      ctx.globalAlpha = alpha;
      ctx.fillRect(screenX, star.y, star.size, star.size);
      ctx.globalAlpha = 1;
    }
  }
  
  // Draw moon
  ctx.font = "60px serif";
  const moonScreenX = backgroundElements.moon.x - cameraX * 0.05;
  if (moonScreenX > -100 && moonScreenX < canvas.width + 100) {
    ctx.fillText("🌙", moonScreenX, backgroundElements.moon.y);
  }
}

function drawOceanElements() {
  ctx.font = "20px serif";
  ctx.globalAlpha = 0.3; // Make fish very faded
  for (const fish of backgroundElements.fish) {
    const screenX = fish.x - cameraX * 0.4; // Parallax effect
    if (screenX > -50 && screenX < canvas.width + 50) {
      const swimOffset = Math.sin(fish.swim) * 5;
      ctx.fillText("🐟", screenX, fish.y + swimOffset);
    }
  }
  
  ctx.font = "28px serif";
  ctx.globalAlpha = 0.25; // Make sea animals even more faded
  for (const animal of backgroundElements.seaAnimals) {
    const screenX = animal.x - cameraX * 0.3; 
    if (screenX > -50 && screenX < canvas.width + 50) {
      const bobOffset = Math.sin(animal.bob) * 8;
      ctx.fillText("🐠", screenX, animal.y + bobOffset);
    }
  }
  ctx.globalAlpha = 1; // Reset alpha
}

function updateBackgroundElements() {
  if (bgTheme === "sky") {
    // Update clouds
    for (const cloud of backgroundElements.clouds) {
      cloud.x += cloud.speed;
      if (cloud.x > canvas.width + cameraX + 100) {
        cloud.x = cameraX - 100;
      }
    }
  } else if (bgTheme === "space") {
    // Update stars twinkling
    for (const star of backgroundElements.stars) {
      star.twinkle += 0.1;
    }
    // Update moon rotation
    backgroundElements.moon.phase += 0.01;
  } else if (bgTheme === "ocean") {
    // Update fish swimming
    for (const fish of backgroundElements.fish) {
      fish.x += fish.speed * fish.direction;
      fish.swim += 0.1;
      if (fish.x > canvas.width + cameraX + 100) {
        fish.x = cameraX - 100;
        fish.direction = 1;
      } else if (fish.x < cameraX - 100) {
        fish.x = canvas.width + cameraX + 100;
        fish.direction = -1;
      }
    }
    // Update sea animals bobbing
    for (const animal of backgroundElements.seaAnimals) {
      animal.x += animal.speed * animal.direction;
      animal.bob += 0.05;
      if (animal.x > canvas.width + cameraX + 100) {
        animal.x = cameraX - 100;
        animal.direction = 1;
      } else if (animal.x < cameraX - 100) {
        animal.x = canvas.width + cameraX + 100;
        animal.direction = -1;
      }
    }
  }
}


function checkCollisions() {
  const playerWorldX = player.x + cameraX;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.collected && Math.hypot(it.x - playerWorldX, it.y - player.y) < 40) {
      it.collected = true;
      score += 10; // Added points for collecting stars
    }
  }
  for (let i = 0; i < bombs.length; i++) {
    const b = bombs[i];
    if (!b.hit && Math.hypot(b.x - playerWorldX, b.y - player.y) < 40) {
      b.hit = true;
      endGame(); // Game becomes over when bomb is hit
      playTone(sounds.hit, 120, "sawtooth");
    }
  }
}

function applyTheme() {
  const gradients = {
    sky: ["#89f7fe", "#66a6ff"],
    space: ["#0f0c29", "#302b63", "#24243e"],
    ocean: ["#00c6ff", "#0072ff"]
  };
  const g = gradients[bgTheme];
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.forEach((c, i) => grd.addColorStop(i / (g.length - 1), c));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function loop() {
  
  if (gameOver) {
    return;
  }

  if (paused) {
    animationFrameId = requestAnimationFrame(loop);
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  applyTheme();
  
  // Update and draw background elements
  updateBackgroundElements();
  drawBackgroundElements();
  
  // Player physics
  player.vy += gravity;
  player.y += player.vy;
  
  // Screen boundary collision , player character bounces off top and bottom
  if (player.y < 50) { // Top boundary is 50px from top to account for character size
    player.y = 50;
    player.vy = Math.abs(player.vy) * 0.7; // Character Bounces with some energy loss
    playTone(sounds.hit, 300, "triangle", 0.05); // Bounce sound
  }
  if (player.y > canvas.height - 50) { // Bottom boundary is 50px from bottom
    player.y = canvas.height - 50;
    player.vy = -Math.abs(player.vy) * 0.7; // Bounce upward with some energy loss
  }
  
  // Move forward through the world
  cameraX += worldSpeed;  
  // Calculate distance score
  const distanceScore = Math.floor(cameraX / 10);
  
  checkCollisions();
  drawItems();
  drawBombs();
  drawPlayer();
  
  // Display the distance and stars that have been collected
  document.getElementById("score").textContent = `Distance: ${distanceScore} | Stars: ${score}`;

  // character stays within screen bounds
  animationFrameId = requestAnimationFrame(loop);
}

function endGame() {
  gameOver = true;
  stopBackgroundMusic();
  document.getElementById("game").classList.remove("active");
  document.getElementById("gameOver").classList.add("active");
  const distanceScore = Math.floor(cameraX / 10);
  document.getElementById("finalScore").textContent = `Distance: ${distanceScore} | Stars: ${score}`;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// UI events
document.getElementById("startBtn").onclick = startGame;
document.getElementById("restartBtn").onclick = () => {
  document.getElementById("gameOver").classList.remove("active");
  document.getElementById("menu").classList.add("active");
  
  // Sync the menu mute button with thecurrent state
  const menuMusicToggle = document.getElementById("menuMusicToggle");
  if (menuMusicToggle) {
    menuMusicToggle.textContent = isMuted ? "Unmute Background Music" : "Mute Background Music";
  }
};

// Pause or resume, mute or unmute, and quit controls while the game is being played
const pauseBtn = document.getElementById("pauseBtn");
const muteBtn = document.getElementById("muteBtn");
const quitBtn = document.getElementById("quitBtn");

if (pauseBtn) {
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
    // Pause or resume music along with the game
    if (paused && bgAudio) {
      bgAudio.pause();
    } else if (!paused && musicPlaying && bgAudio && !isMuted) {
      bgAudio.play();
    }
  });
}

if (muteBtn) {
  // This mute button mutes the game and can also unmute it
  muteBtn.textContent = isMuted ? "Unmute" : "Mute";
  
  muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? "Unmute" : "Mute";
    
    if (isMuted) {
      if (bgAudio) bgAudio.pause();
    } else {
      if (bgAudio && musicPlaying) {
        bgAudio.play();
      }
    }
  });
}

if (quitBtn) {
  quitBtn.addEventListener("click", () => {
    const confirmQuit = confirm("Do you want to quit?");
    if (confirmQuit) {
      // This quits the game and returns it to the previous menu
      gameOver = true;
      paused = false;
      stopBackgroundMusic();
      document.getElementById("game").classList.remove("active");
      document.getElementById("menu").classList.add("active");
    } else {
      // This Resumes the game if it was previously paused by the quit prompt
      paused = false;
      pauseBtn.textContent = "Pause";
    }
  });
}

document.getElementById("charSelect").addEventListener("click", e => {
  if (e.target.dataset.char) {
    selectedChar = e.target.dataset.char;
    [...e.currentTarget.children].forEach(btn => btn.classList.remove("selected"));
    e.target.classList.add("selected");
  }
});
document.getElementById("themeSelect").addEventListener("click", e => {
  if (e.target.dataset.theme) {
    bgTheme = e.target.dataset.theme;
    [...e.currentTarget.children].forEach(btn => btn.classList.remove("selected"));
    e.target.classList.add("selected");
    // Recreate the background elements for the new theme
    if (typeof createBackgroundElements === 'function') {
      createBackgroundElements();
    }
    // Change music if game is playing
    if (musicPlaying) {
      playThemeMusic(bgTheme);
    }
  }
});

// Menu audio controls
const menuMusicToggle = document.getElementById("menuMusicToggle");
const menuVolume = document.getElementById("menuVolume");
if (menuMusicToggle && menuVolume) {
  // This is used to increase or decrease the volume of the music
  menuVolume.value = String(musicVolume);

  menuMusicToggle.addEventListener("click", () => {
    isMuted = !isMuted;
    if (isMuted) {
      if (bgAudio) bgAudio.pause();
      menuMusicToggle.textContent = "Unmute Background Music";
    } else {
      menuMusicToggle.textContent = "Mute Background Music";
      if (bgAudio && musicPlaying) {
        bgAudio.play();
      }
    }
  });

  menuVolume.addEventListener("input", () => {
    musicVolume = parseFloat(menuVolume.value);
    if (bgAudio) bgAudio.volume = musicVolume;
  });
}

// This is used to make the character move up when the player clicks the screen
canvas.addEventListener("click", () => {
  if (!gameOver) {
    if (!paused) {
      player.vy = -12;
      playTone(sounds.jump, 800, "square");
    }
  }
});
