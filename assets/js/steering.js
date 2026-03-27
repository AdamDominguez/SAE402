// --- GLOBAL VARIABLES ---
const volant = document.querySelector('.buggatiroyale_wheel');
const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const skyImg = new Image();
skyImg.src = 'assets/img/mulhouse_sky.png';
const planeImg = new Image();
planeImg.src = 'assets/img/american_plane.png';
const bombImg = new Image();
bombImg.src = 'assets/img/american_bomb.png';

let bombs = [];
let explosions = []; // Array to hold active explosion particles
let health = 3;
let gameOver = false;
let rotation = 0, pitch = 45, roadShiftX = 0, lineOffset = 0, frameCount = 0;
let pairedBuildings = [];
let loadedBuildings = [];
let imagesReady = false;
const TOTAL_VARIATIONS = 5;

const enemy = {
    x: window.innerWidth / 2,
    y: 50,
    width: 160,  // Adjusted for 634x99 aspect ratio
    height: 25,  // Adjusted for 634x99 aspect ratio
    speed: 3,
    direction: 1,
    lastDrop: 0,
    dropInterval: 1500
};

// Replace the window.innerWidth lines with this:
canvas.width = document.body.clientWidth;
canvas.height = document.body.clientHeight;

// --- ASSET LOADING ---
const loadAssets = () => {
    let loadedCount = 0;
    for (let i = 0; i < TOTAL_VARIATIONS; i++) {
        let img = new Image();
        img.src = `assets/img/mulhouse_building_${i}.png`;
        img.onload = () => {
            loadedCount++;
            loadedBuildings.push(img);
            if (loadedCount === TOTAL_VARIATIONS) {
                imagesReady = true;
                console.log("Assets loaded. Click to start.");
            }
        };
    }
};
loadAssets();

// --- CONTROLS & INIT ---
const handleOrientation = (event) => {
    rotation = event.gamma || 0;
    pitch = event.beta || 15;
    if (volant) volant.style.transform = `rotate(${rotation}deg)`;
};

const startEngine = () => {
    if (!imagesReady) return window.addEventListener("click", startEngine, { once: true });

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission().then(state => {
            if (state === "granted") initGame();
        });
    } else {
        initGame();
    }
};

const initGame = () => {
    window.addEventListener("deviceorientation", handleOrientation);
    requestAnimationFrame(gameLoop);
};
window.addEventListener("click", startEngine, { once: true });

// --- GAME LOGIC ---
const updateBuildings = (speedMult, horizonY, tL, tR, bL, bR) => {
    if (pairedBuildings.length === 0 || pairedBuildings[pairedBuildings.length - 1].y > horizonY + 50) {
        pairedBuildings.push({
            y: horizonY - 20,
            img: loadedBuildings[Math.floor(Math.random() * loadedBuildings.length)]
        });
    }

    for (let i = pairedBuildings.length - 1; i >= 0; i--) {
        let b = pairedBuildings[i];
        b.y += (3 * speedMult);

        let progress = Math.max(0, (b.y - horizonY) / (canvas.height - horizonY));
        let scale = 0.2 + progress * 4.0;
        let w = b.img.width * scale;
        let h = b.img.height * scale;

        let roadPosL = tL * (1 - progress) + bL * progress;
        let roadPosR = tR * (1 - progress) + bR * progress;

        // Left Building
        ctx.save();
        ctx.translate(roadPosL - w, b.y);
        ctx.transform(-3, 0.2, 0, 1.5, 0, -(w * 0.2 * 0.1));
        ctx.drawImage(b.img, 0, -h, w, h);
        ctx.restore();

        // Right Building
        ctx.save();
        ctx.translate(roadPosR, b.y);
        ctx.transform(3, 0.1, 0, 1.5, 0, 0);
        ctx.drawImage(b.img, 0, -h, w, h);
        ctx.restore();

        if (b.y - h > canvas.height) pairedBuildings.splice(i, 1);
    }
};

const createExplosion = (x, y, baseColor = "orange") => {
    for (let i = 0; i < 40; i++) { // More particles
        explosions.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 25, // Lower velocity so they stay visible
            vy: (Math.random() - 0.5) * 25,
            radius: Math.random() * 15 + 10, // Larger particles
            alpha: 1.0,
            color: Math.random() > 0.5 ? baseColor : "yellow"
        });
    }
};

const updateAndDrawExplosions = () => {
    for (let i = explosions.length - 1; i >= 0; i--) {
        let p = explosions[i];
        p.x += p.vx;
        p.y += p.vy;
        p.radius *= 0.95; // Shrink particle over time
        p.alpha -= 0.03;  // Fade out

        if (p.alpha <= 0) {
            explosions.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
};

const updateEnemyAndBombs = (speedMult) => {
    // Stop moving enemy and spawning if dead
    if (!gameOver) {
        enemy.x += enemy.speed * enemy.direction;
        if (enemy.x > canvas.width - enemy.width || enemy.x < 0) enemy.direction *= -1;

        const now = Date.now();
        if (now - enemy.lastDrop > enemy.dropInterval) {
            bombs.push({
                startX: enemy.x + enemy.width / 2,
                y: enemy.y + enemy.height,
                speed: 3,
                size: 10 // Base width size
            });
            enemy.lastDrop = now;
        }
    }

    if (planeImg.complete) {
        ctx.drawImage(planeImg, enemy.x, enemy.y, enemy.width, enemy.height);
    } else {
        // Fallback just in case the image takes a second to load
        ctx.fillStyle = "red";
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }

    for (let i = bombs.length - 1; i >= 0; i--) {
        let b = bombs[i];
        b.y += b.speed + (speedMult * 2.5);

        let progress = Math.max(0, (b.y - enemy.y) / (canvas.height - enemy.y));

        // Calculate dynamic size based on progress
        let currentWidth = b.size + (progress * 50);
        // Multiply by (773 / 202) to maintain the exact aspect ratio of the bomb image
        let currentHeight = currentWidth * (773 / 202);

        let drawX = b.startX + (roadShiftX * progress);

        // --- DRAW THE BOMB IMAGE ---
        if (bombImg.complete) {
            // Draw image centered horizontally and vertically around its hit coordinate
            ctx.drawImage(bombImg, drawX - currentWidth / 2, b.y - currentHeight / 2, currentWidth, currentHeight);
        } else {
            // Fallback circle
            ctx.fillStyle = "yellow";
            ctx.beginPath();
            ctx.arc(drawX, b.y, currentWidth / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "orange";
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        // ---------------------------

        // Collision Check
        if (b.y > canvas.height - 150 && b.y < canvas.height - 50) {
            let hitRadius = currentWidth * 0.6;
            if (Math.abs(drawX - canvas.width / 2) < hitRadius) {
                health--;
                createExplosion(drawX, b.y, "red"); // Create particle blast
                bombs.splice(i, 1);
                checkGameOver();
                continue;
            }
        }

        // Bomb misses and hits ground
        if (b.y > canvas.height + 50) {
            createExplosion(drawX, canvas.height - 20, "orange");
            bombs.splice(i, 1);
        }
    }

    updateAndDrawExplosions(); // Ensure this is always called to animate remaining fragments
};

const checkGameOver = () => {
    if (health <= 0 && !gameOver) {
        gameOver = true;
        // Wait 0.8 seconds so the explosion animation finishes playing
        setTimeout(() => {
            alert("GAME OVER - Votre Bugatti est détruite !");
            location.reload();
        }, 800);
    }
};

const drawUI = () => {
    ctx.fillStyle = "white";
    ctx.font = "bold 20px Arial";
    ctx.fillText(`VIES: ${"❤️".repeat(health)}`, 20, 40);
};

// --- MAIN GAME LOOP ---
const gameLoop = () => {
    // REMOVED the "if (gameOver) return;" so the canvas keeps animating the explosion
    requestAnimationFrame(gameLoop);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    // If dead, hit the brakes! Set speed to 0.
    let speedMult = gameOver ? 0 : Math.max(0.1, Math.min(1 + ((45 - pitch) * 0.04), 3));
    roadShiftX = Math.max(-canvas.width, Math.min(roadShiftX - (rotation * 0.2 * speedMult), canvas.width));
    lineOffset += speedMult * 1.5;

    const horizonY = canvas.height * 0.45;
    const horizonX = (canvas.width / 2) + roadShiftX;

    // Draw Sky
    if (skyImg.complete) {
        let skyOffset = (roadShiftX * 0.15) % canvas.width;
        ctx.drawImage(skyImg, skyOffset, 0, canvas.width, horizonY);
        ctx.drawImage(skyImg, skyOffset - canvas.width, 0, canvas.width, horizonY);
    }

    // Draw Moving Floor
    const floorHeight = canvas.height - horizonY;
    const numSlices = 40;
    const sliceHeight = floorHeight / numSlices;

    ctx.beginPath();
    for (let i = 0; i < numSlices; i++) {
        let progress = i / numSlices;
        let dy = horizonY + (i * sliceHeight);

        ctx.fillStyle = (Math.floor(i + lineOffset) % 10 < 5) ? "#444444" : "#555555";
        ctx.fillRect(0, dy, canvas.width, sliceHeight + 1);

        ctx.moveTo(0, dy);
        ctx.lineTo(canvas.width, dy);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.stroke();

    // Shadow Gradient
    let grad = ctx.createLinearGradient(0, horizonY, 0, horizonY + 150);
    grad.addColorStop(0, 'rgba(0,0,0,0.8)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY, canvas.width, 150);

    // Update & Draw Elements
    const tW = 300, bW = canvas.width * 1.25;
    updateBuildings(speedMult, horizonY, horizonX - tW, horizonX + tW, (canvas.width / 2) - bW, (canvas.width / 2) + bW);
    updateEnemyAndBombs(speedMult);
    drawUI();
};