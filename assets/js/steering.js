let gameIntro = document.querySelector(`.gameIntro`);
let gameIntroBtn = document.querySelector(`.gameIntroBtn`);
let loadedBuildings = [];
let imagesReady = false;
const volant = document.querySelector('.buggatiroyale_wheel');
const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const skyImg = new Image();
skyImg.src = 'assets/img/mulhouse_sky.png';
const planeImg = new Image();
planeImg.src = 'assets/img/american_plane.png';
const bombImg = new Image();
bombImg.src = 'assets/img/american_bomb.png';
const pieceImg = new Image();
pieceImg.src = 'assets/img/chronorouage_piece.png';
let bombs = [];
let explosions = [];
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

    // canvas.width = document.body.clientWidth;
    // canvas.height = document.body.clientHeight;

    function affichage() {
        let largeur = window.innerWidth;
        let hauteur = window.innerHeight;

        canvas.width = largeur;
        canvas.height = hauteur;
    }

    window.addEventListener(`resize`, affichage);
    affichage();

    const enemy = {
        x: document.body.clientWidth / 2,
        y: 50,
        width: 160,
        height: 25,
        speed: 2,
        direction: 1,
        lastDrop: 0,
        dropInterval: 1500
    };

    const handleOrientation = (event) => {
        rotation = event.gamma || 0;
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

    const updateBuildings = (speedMult, horizonY, tL, tR, bL, bR) => {
        if (pairedBuildings.length === 0 || pairedBuildings[pairedBuildings.length - 1].y > horizonY + 8) {
            pairedBuildings.push({
                y: horizonY,
                img: loadedBuildings[Math.floor(Math.random() * loadedBuildings.length)]
            });
        }

        for (let i = pairedBuildings.length - 1; i >= 0; i--) {
            let b = pairedBuildings[i];
            b.y += 3 * speedMult;

            let progress = Math.max(0, (b.y - horizonY) / (canvas.height - horizonY));
            let scale = 0.2 + progress * 4.0;
            let w = b.img.width * scale * 1.5;
            let h = b.img.height * scale;

            let roadPosL = tL * (1 - progress) + bL * progress;
            let roadPosR = tR * (1 - progress) + bR * progress;
            let fadeAlpha = Math.min(1, progress * 26);

            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            ctx.translate(roadPosL - w, b.y);
            ctx.transform(-3, 0.2, 0, 1.5, 0, -(w * 0.2 * 0.1));
            ctx.drawImage(b.img, 0, -h, w, h);
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            ctx.translate(roadPosR, b.y);
            ctx.transform(3, 0.1, 0, 1.5, 0, 0);
            ctx.drawImage(b.img, 0, -h, w, h);
            ctx.restore();

            if (b.y - h > canvas.height) pairedBuildings.splice(i, 1);
        }
    };

    const createExplosion = (x, y, baseColor = "orange") => {
        for (let i = 0; i < 40; i++) {
            explosions.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 25,
                vy: (Math.random() - 0.5) * 25,
                radius: Math.random() * 15 + 10,
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
            p.radius *= 0.95;
            p.alpha -= 0.03;

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
        if (!gameOver && !winSequence) {
            enemy.x += enemy.speed * enemy.direction;
            if (enemy.x > canvas.width - enemy.width || enemy.x < 0) enemy.direction *= -1;

            const now = Date.now();
            if (now - enemy.lastDrop > enemy.dropInterval) {
                bombs.push({
                    startX: enemy.x + enemy.width / 2,
                    y: enemy.y + enemy.height,
                    speed: 3,
                    size: 10
                });
                enemy.lastDrop = now;
            }
        }

        if (planeImg.complete) {
            ctx.drawImage(planeImg, enemy.x, enemy.y, enemy.width, enemy.height);
        } else {
            ctx.fillStyle = "red";
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }

        for (let i = bombs.length - 1; i >= 0; i--) {
            let b = bombs[i];
            b.y += b.speed + (speedMult * 2.5);

            let progress = Math.max(0, (b.y - enemy.y) / (canvas.height - enemy.y));
            let currentWidth = b.size + (progress * 50);
            let currentHeight = currentWidth * (773 / 202);
            let drawX = b.startX + (roadShiftX * progress);

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

    const updatePiece = (speedMult, horizonY, horizonX) => {
        if (!winSequence || !pieceObj) return;

        pieceObj.y += 3 * speedMult;

        let progress = Math.max(0, (pieceObj.y - horizonY) / (canvas.height - horizonY));
        let currentWidth = 20 + (progress * 150);
        let currentHeight = currentWidth;
        let drawX = horizonX * (1 - progress) + (canvas.width / 2) * progress;

        if (pieceImg.complete) {
            ctx.drawImage(pieceImg, drawX - currentWidth / 2, pieceObj.y - currentHeight, currentWidth, currentHeight);
        } else {
            ctx.fillStyle = "cyan";
            ctx.fillRect(drawX - currentWidth / 2, pieceObj.y - currentHeight, currentWidth, currentHeight);
        }

        if (pieceObj.y > canvas.height - 50 && !gameOver) {
            gameOver = true;
            setTimeout(() => {
                alert("Succès ! Vous avez obtenu le chronorouage_piece !");
                location.reload();
            }, 500);
        }
    };

    const checkGameOver = () => {
        if (health <= 0 && !gameOver) {
            gameOver = true;
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
        ctx.textAlign = "center";
        ctx.fillText(`TEMPS: ${timeStr}`, canvas.width / 2, 40);
        ctx.textAlign = "left";
    };

    const gameLoop = () => {
        requestAnimationFrame(gameLoop);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frameCount++;

        if (!gameOver && !winSequence) {
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

        let speedMult = gameOver ? 0 : 0.2;
        roadShiftX = Math.max(-canvas.width * 0.6, Math.min(roadShiftX - (rotation * 0.2 * speedMult), canvas.width * 0.6));
        lineOffset -= speedMult * 0.4;

        if (lineOffset < 0) lineOffset += 100;

        const horizonY = canvas.height * 0.45;
        const horizonX = (canvas.width / 2) + roadShiftX;
        const bottomShiftX = roadShiftX * 0.4;

        if (skyImg.complete) {
            let skyOffset = (roadShiftX * 0.15) % canvas.width;
            ctx.drawImage(skyImg, skyOffset, 0, canvas.width, horizonY);
            ctx.drawImage(skyImg, skyOffset - canvas.width, 0, canvas.width, horizonY);
        }

        const floorHeight = canvas.height - horizonY;

        const numRailSegments = 20;
        let railOffset = 1 - ((lineOffset % 10) / 10);
        const trackWidthHorizon = 40;
        const trackWidthForeground = 180;

        for (let i = 0; i < numRailSegments; i++) {
            let depth = (i + railOffset) / numRailSegments;
            let progress = depth * depth;

            if (progress <= 0.01 || progress > 1) continue;

            let dy = horizonY + (floorHeight * progress);
            let currentTrackWidth = trackWidthHorizon * (1 - progress) + trackWidthForeground * progress;
            let lineX = horizonX * (1 - progress) + ((canvas.width / 2) + bottomShiftX) * progress;

            ctx.lineWidth = 1 + (progress * 5);

            ctx.beginPath();
            ctx.moveTo(lineX - currentTrackWidth / 2, dy);
            ctx.lineTo(lineX - currentTrackWidth / 2, dy + (floorHeight / numRailSegments));
            ctx.moveTo(lineX + currentTrackWidth / 2, dy);
            ctx.lineTo(lineX + currentTrackWidth / 2, dy + (floorHeight / numRailSegments));
            ctx.stroke();
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.stroke();

        let grad = ctx.createLinearGradient(0, horizonY, 0, horizonY + 150);
        grad.addColorStop(0, 'rgba(0,0,0,0.8)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, horizonY, canvas.width, 150);

        const tW = 10;
        const bW = canvas.width * 0.85;

        updateBuildings(speedMult, horizonY, horizonX - tW, horizonX + tW, (canvas.width / 2) - bW + bottomShiftX, (canvas.width / 2) + bW + bottomShiftX);
        updateEnemyAndBombs(speedMult);
        updatePiece(speedMult, horizonY, horizonX);
        drawUI();
    };

    startEngine();
})