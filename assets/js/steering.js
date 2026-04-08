let gameIntro = document.querySelector(`.gameIntro`);
let gameIntroBtn = document.querySelector(`.gameIntroBtn`);
let loadedBuildings = [];
let imagesReady = false;
const volant = document.querySelector('.buggatiroyale_wheel');
const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');

// --- ASSETS (IMAGES) ---
const skyImg = new Image();
skyImg.src = 'assets/img/mulhouse_sky.png';
const planeImg = new Image();
planeImg.src = 'assets/img/american_plane.png';
const bombImg = new Image();
bombImg.src = 'assets/img/american_bomb.png';
const pieceImg = new Image();
pieceImg.src = 'assets/img/chronorouage_piece.png';
const tramImg = new Image();
tramImg.src = 'assets/img/tramway.png';

// --- ASSETS (AUDIO) ---
const sndEngine = new Audio('assets/sons/voiture.mp3');
sndEngine.loop = true;
sndEngine.volume = 0.5;

const sndPlane = new Audio('assets/sons/avion.mp3');
sndPlane.loop = true;
sndPlane.volume = 0.4;

const sndDrift = new Audio('assets/sons/drift.mp3');
sndDrift.loop = true;
sndDrift.volume = 0.6;

// Helper to allow multiple overlapping explosion sounds
const playExplosionSound = () => {
    const snd = new Audio('assets/sons/explosion.mp3');
    snd.volume = 0.8;
    snd.play().catch(e => console.warn("Audio play failed:", e));
};

const playTramSound = () => {
    const snd = new Audio('assets/sons/cling.mp3');
    snd.volume = 0.7;
    snd.play().catch(e => console.warn("Audio play failed:", e));
};

let bombs = [];
let explosions = [];
let trams = [];
let health = 3;
let gameOver = false;
let rotation = 0, pitch = 45, roadShiftX = 0, lineOffset = 0, frameCount = 0;
let pairedBuildings = [];
let timeLeft = 30;
let lastTick = Date.now();
let winSequence = false;
let pieceObj = null;
const TOTAL_VARIATIONS = 5;

const loadAssets = () => {
    let loadedCount = 0;
    for (let i = 0; i < TOTAL_VARIATIONS; i++) {
        let img = new Image();
        img.src = `assets/img/mulhouse_building_${i}.png`;
        img.onload = () => {
            loadedCount++;
            loadedBuildings.push(img);
            if (loadedCount === TOTAL_VARIATIONS) imagesReady = true;
        };
    }
};
loadAssets();

gameIntroBtn.addEventListener("click", async (e) => {
    e.stopPropagation();

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === "function") {
        try {
            const permissionState = await DeviceOrientationEvent.requestPermission();
            if (permissionState !== 'granted') {
                console.warn("Permission gyroscope refusée.");
            }
        } catch (err) {
            console.error("Erreur permission:", err);
        }
    }

    gameIntro.remove();

    // Start looping ambient sounds after user interaction
    sndEngine.play().catch(e => console.warn(e));
    sndPlane.play().catch(e => console.warn(e));

    function affichage() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener(`resize`, affichage);
    affichage();

    let carX = 0;
    const ROAD_WIDTH = 2400;

    const enemy = {
        worldX: 0,
        y: 50,
        width: 160,
        height: 25,
        speed: 8,
        direction: 1,
        lastDrop: 0,
        dropInterval: 1500
    };

    let currentSpeed = 0.2;
    let targetSpeed = 0.2;

    const handleOrientation = (event) => {
        rotation = event.gamma || 0;
        pitch = event.beta || 45;

        if (volant) volant.style.transform = `rotate(${rotation}deg)`;
    };

    window.addEventListener("deviceorientation", handleOrientation);

    const startEngine = () => {
        if (!imagesReady) {
            requestAnimationFrame(startEngine);
            return;
        }
        requestAnimationFrame(gameLoop);
    };

    const getScreenX = (worldX, progress, horizonX) => {
        let scale = 0.05 + progress * 0.95;
        let center = horizonX * (1 - progress) + (canvas.width / 2) * progress;
        return center + (worldX - carX) * scale;
    };

    const updateBuildings = (speedMult, horizonY, horizonX) => {
        if (pairedBuildings.length === 0 || pairedBuildings[pairedBuildings.length - 1].y > horizonY + 8) {
            pairedBuildings.push({
                y: horizonY,
                img: loadedBuildings[Math.floor(Math.random() * loadedBuildings.length)]
            });
        }

        for (let i = pairedBuildings.length - 1; i >= 0; i--) {
            let b = pairedBuildings[i];
            b.y += 3 * speedMult;

            let linearProgress = Math.max(0, (b.y - horizonY) / (canvas.height - horizonY));
            let progress = linearProgress * linearProgress;
            let renderY = horizonY + (canvas.height - horizonY) * progress;

            let scale = 0.2 + progress * 4.0;
            let w = b.img.width * scale * 1.5;
            let h = b.img.height * scale;

            let roadPosL = getScreenX(-ROAD_WIDTH, progress, horizonX);
            let roadPosR = getScreenX(ROAD_WIDTH, progress, horizonX);

            let fadeAlpha = Math.min(1, linearProgress * 26);

            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            ctx.translate(roadPosL, renderY);
            ctx.transform(-3, 0.15, 0, 1.5, 0, 0);
            ctx.drawImage(b.img, 0, -h, w, h);
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            ctx.translate(roadPosR, renderY);
            ctx.transform(3, 0.15, 0, 1.5, 0, 0);
            ctx.drawImage(b.img, 0, -h, w, h);
            ctx.restore();

            if (renderY - h > canvas.height) pairedBuildings.splice(i, 1);
        }
    };

    const createExplosion = (x, y, baseColor = "orange") => {
        playExplosionSound(); // Trigger sound on explosion
        for (let i = 0; i < 40; i++) {
            explosions.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 25, vy: (Math.random() - 0.5) * 25,
                radius: Math.random() * 15 + 10, alpha: 1.0,
                color: Math.random() > 0.5 ? baseColor : "yellow"
            });
        }
    };

    const updateAndDrawExplosions = () => {
        for (let i = explosions.length - 1; i >= 0; i--) {
            let p = explosions[i];
            p.x += p.vx; p.y += p.vy; p.radius *= 0.95; p.alpha -= 0.03;

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

    const updateEnemyAndBombs = (speedMult, horizonX) => {
        if (!gameOver && !winSequence) {
            enemy.worldX += enemy.speed * enemy.direction;

            if (Math.random() < 0.02) enemy.direction *= -1;

            if (Math.abs(enemy.worldX) > ROAD_WIDTH - 200) {
                enemy.direction *= -1;
                enemy.worldX = Math.sign(enemy.worldX) * (ROAD_WIDTH - 200);
            }

            const now = Date.now();
            if (now - enemy.lastDrop > enemy.dropInterval) {
                bombs.push({
                    worldX: enemy.worldX,
                    y: enemy.y + enemy.height,
                    speed: 3, size: 10
                });
                enemy.lastDrop = now;
            }
        } else {
            // Stop plane sound if game over or won
            sndPlane.pause();
        }

        let planeDrawX = (canvas.width / 2) + (enemy.worldX - carX) * 0.4;
        if (planeImg.complete) {
            ctx.drawImage(planeImg, planeDrawX - enemy.width / 2, enemy.y, enemy.width, enemy.height);
        } else {
            ctx.fillStyle = "red";
            ctx.fillRect(planeDrawX - enemy.width / 2, enemy.y, enemy.width, enemy.height);
        }

        for (let i = bombs.length - 1; i >= 0; i--) {
            let b = bombs[i];
            b.y += b.speed + (speedMult * 2.5);

            let linearProgress = Math.max(0, (b.y - enemy.y) / (canvas.height - enemy.y));
            let progress = linearProgress * linearProgress;

            let currentWidth = b.size + (progress * 50);
            let currentHeight = currentWidth * (773 / 202);

            let drawX = getScreenX(b.worldX, progress, horizonX);

            if (bombImg.complete) {
                ctx.drawImage(bombImg, drawX - currentWidth / 2, b.y - currentHeight / 2, currentWidth, currentHeight);
            } else {
                ctx.fillStyle = "yellow";
                ctx.beginPath();
                ctx.arc(drawX, b.y, currentWidth / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "orange";
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            if (b.y > canvas.height - 150 && b.y < canvas.height - 50) {
                let hitRadius = currentWidth * 0.6;
                if (Math.abs(drawX - canvas.width / 2) < hitRadius) {
                    health--;
                    createExplosion(drawX, b.y, "red");
                    bombs.splice(i, 1);
                    checkGameOver();
                    continue;
                }
            }

            if (b.y > canvas.height + 50) {
                createExplosion(drawX, canvas.height - 20, "orange");
                bombs.splice(i, 1);
            }
        }
        updateAndDrawExplosions();
    };

    const updateTrams = (speedMult, horizonY, horizonX) => {
        if (!gameOver && !winSequence && Math.random() < 0.003 && trams.length === 0) {
            let startSide = Math.random() > 0.5 ? 1 : -1;
            trams.push({
                y: horizonY,
                direction: -startSide,
                worldX: startSide * ROAD_WIDTH,
                speedX: 3.5
            });
            playTramSound(); // Play tram sound when it spawns
        }

        for (let i = trams.length - 1; i >= 0; i--) {
            let t = trams[i];

            t.y += 3 * speedMult;
            t.worldX += t.speedX * t.direction;

            let linearProgress = Math.max(0, (t.y - horizonY) / (canvas.height - horizonY));

            if (linearProgress > 1.1) {
                trams.splice(i, 1);
                continue;
            }

            let progress = linearProgress * linearProgress;
            let renderY = horizonY + (canvas.height - horizonY) * progress;

            let scale = 0.2 + progress * 3.5;
            let w = (tramImg.complete && tramImg.width > 0 ? tramImg.width : 250) * scale;
            let h = (tramImg.complete && tramImg.height > 0 ? tramImg.height : 100) * scale;

            let drawX = getScreenX(t.worldX, progress, horizonX);

            if (drawX + w / 2 < -500 || drawX - w / 2 > canvas.width + 500) continue;

            if (tramImg.complete && tramImg.width > 0) {
                ctx.drawImage(tramImg, drawX - w / 2, renderY - h, w, h);
            } else {
                ctx.fillStyle = "darkblue";
                ctx.fillRect(drawX - w / 2, renderY - h, w, h);
            }

            if (renderY > canvas.height - 100 && renderY < canvas.height + 50 && !gameOver) {
                let hitRadius = w * 0.4;
                if (Math.abs(drawX - canvas.width / 2) < hitRadius) {
                    createExplosion(canvas.width / 2, canvas.height - 50, "blue");
                    health = 0;
                    gameOver = true;
                    setTimeout(() => {
                        alert("GAME OVER - Percuté par le tramway !");
                        location.reload();
                    }, 800);
                }
            }
        }
    };

    const updatePiece = (speedMult, horizonY, horizonX) => {
        if (!winSequence || !pieceObj) return;

        pieceObj.y += 5 + (10 * speedMult);

        let linearProgress = Math.max(0, (pieceObj.y - horizonY) / (canvas.height - horizonY));
        let progress = linearProgress * linearProgress;
        let renderY = horizonY + (canvas.height - horizonY) * progress;

        let currentWidth = 20 + (progress * 150);
        let currentHeight = currentWidth;

        let drawX = getScreenX(0, progress, horizonX);

        if (pieceImg.complete) {
            ctx.drawImage(pieceImg, drawX - currentWidth / 2, renderY - currentHeight, currentWidth, currentHeight);
        } else {
            ctx.fillStyle = "cyan";
            ctx.fillRect(drawX - currentWidth / 2, renderY - currentHeight, currentWidth, currentHeight);
        }

        if (renderY > canvas.height - 50 && !gameOver) {
            if (Math.abs(drawX - canvas.width / 2) < currentWidth) {
                gameOver = true;
                sndEngine.pause();
                sndDrift.pause();
                setTimeout(() => {
                    alert("Succès ! Vous avez obtenu le chronorouage_piece !");
                    location.reload();
                }, 500);
            } else if (renderY > canvas.height + 100) {
                pieceObj.y = horizonY;
            }
        }
    };

    const checkGameOver = () => {
        if (health <= 0 && !gameOver) {
            gameOver = true;
            sndEngine.pause();
            sndDrift.pause();
            setTimeout(() => {
                alert("GAME OVER - Votre Bugatti est détruite !");
                location.reload();
            }, 800);
        }
    };

    const drawUI = () => {
        ctx.fillStyle = "white";
        ctx.font = "bold 20px Arial";

        ctx.textAlign = "left";
        ctx.fillText(`VIES: ${"❤️".repeat(health)}`, 20, 40);

        let m = Math.floor(timeLeft / 60);
        let s = timeLeft % 60;
        let timeStr = `${m}:${s.toString().padStart(2, '0')}`;

        ctx.textAlign = "right";
        ctx.fillText(`TEMPS: ${timeStr}`, canvas.width - 20, 40);
    };

    const gameLoop = () => {
        requestAnimationFrame(gameLoop);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frameCount++;

        if (!gameOver) {
            if (!winSequence) {
                let now = Date.now();
                if (now - lastTick >= 1000) {
                    timeLeft--;
                    lastTick = now;
                    if (timeLeft <= 0) {
                        timeLeft = 0;
                        winSequence = true;
                        pieceObj = { y: canvas.height * 0.45 };
                    }
                }
            }

            let clampedPitch = Math.max(15, Math.min(75, pitch));
            targetSpeed = 0.05 + ((75 - clampedPitch) / 60) * 0.55;
            currentSpeed += (targetSpeed - currentSpeed) * 0.08;

            let deadzoneRotation = Math.abs(rotation) > 3 ? rotation : 0;
            carX += deadzoneRotation * currentSpeed * 2.5;

            // Drift Sound Logic: Play if steering heavily
            if (Math.abs(rotation) > 15 && currentSpeed > 0.1) {
                if (sndDrift.paused) sndDrift.play().catch(() => { });
            } else {
                if (!sndDrift.paused) sndDrift.pause();
            }

            if (Math.abs(carX) > ROAD_WIDTH - 300) {
                health = 0;
                gameOver = true;
                sndEngine.pause();
                sndDrift.pause();
                createExplosion(canvas.width / 2, canvas.height - 50, "orange");
                setTimeout(() => {
                    alert("GAME OVER - Vous avez percuté un bâtiment !");
                    location.reload();
                }, 800);
            }
        }

        let speedMult = gameOver ? 0 : currentSpeed;
        lineOffset -= speedMult * 1.5;
        if (lineOffset < 0) lineOffset += 100;

        const horizonY = canvas.height * 0.45;
        let cameraTilt = rotation * 1.5;
        const horizonX = (canvas.width / 2) + cameraTilt;

        if (skyImg.complete) {
            let skyOffset = (-carX * 0.05) % canvas.width;
            if (skyOffset > 0) skyOffset -= canvas.width;
            ctx.drawImage(skyImg, skyOffset, 0, canvas.width, horizonY);
            ctx.drawImage(skyImg, skyOffset + canvas.width, 0, canvas.width, horizonY);
        }

        const floorHeight = canvas.height - horizonY;

        ctx.fillStyle = "#333336";
        ctx.fillRect(0, horizonY, canvas.width, floorHeight);

        const numHorizontalJoints = 25;
        let moveProgress = 1 - ((lineOffset % 10) / 10);
        ctx.fillStyle = "#3d3d42";

        for (let i = 0; i < numHorizontalJoints; i++) {
            let depth1 = (i + moveProgress) / numHorizontalJoints;
            let depth2 = (i + moveProgress + 0.5) / numHorizontalJoints;
            let prog1 = depth1 * depth1;
            let prog2 = Math.min(1, depth2 * depth2);
            if (prog1 > 1) continue;
            let y1 = horizonY + (floorHeight * prog1);
            let y2 = horizonY + (floorHeight * prog2);
            ctx.fillRect(0, y1, canvas.width, y2 - y1);
        }

        ctx.strokeStyle = "#222225";
        ctx.lineWidth = 2;
        ctx.beginPath();

        const numVerticalJoints = 12;
        for (let i = -numVerticalJoints; i <= numVerticalJoints; i++) {
            let jointWorldX = i * 200;
            let startX = getScreenX(jointWorldX, 0, horizonX);
            let endX = getScreenX(jointWorldX, 1, horizonX);
            ctx.moveTo(startX, horizonY);
            ctx.lineTo(endX, canvas.height);
        }
        ctx.stroke();

        let grad = ctx.createLinearGradient(0, horizonY, 0, horizonY + 120);
        grad.addColorStop(0, 'rgba(0,0,0,0.6)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, horizonY, canvas.width, 120);

        updateBuildings(speedMult, horizonY, horizonX);
        updateTrams(speedMult, horizonY, horizonX);
        updateEnemyAndBombs(speedMult, horizonX);
        updatePiece(speedMult, horizonY, horizonX);
        drawUI();
    };

    startEngine();
});