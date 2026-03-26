let volant = document.querySelector('.buggatiroyale_wheel');
let canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let currentRotation = 0;
let roadShiftX = 0;
let forwardSpeedY = 0;
let bombs = [];
let frameCount = 0;

window.addEventListener("click", handleClick, { once: true });

function handleClick() {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === "granted") {
                    window.addEventListener("deviceorientation", handleOrientation);
                    requestAnimationFrame(gameLoop);
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener("deviceorientation", handleOrientation);
        requestAnimationFrame(gameLoop);
    }
}

function handleOrientation(event) {
    currentRotation = event.gamma || 0;
    volant.style.transform = `rotate(${currentRotation}deg)`;
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    roadShiftX -= currentRotation * 0.15;
    let maxShift = canvas.width / 1.5;
    if (roadShiftX > maxShift) roadShiftX = maxShift;
    if (roadShiftX < -maxShift) roadShiftX = -maxShift;

    forwardSpeedY += 0.08;

    let horizonY = canvas.height * 0.45;
    let horizonX = (canvas.width / 2) + roadShiftX;

    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvas.width, horizonY);

    ctx.fillStyle = "#2b8a3e";
    ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

    let roadTopWidth = 300;
    let roadBottomWidth = canvas.width * 2;
    let topRoadLeft = horizonX - (roadTopWidth / 2);
    let topRoadRight = horizonX + (roadTopWidth / 4);
    let bottomRoadLeft = (canvas.width / 2) - (roadBottomWidth / 2);
    let bottomRoadRight = (canvas.width / 2) + (roadBottomWidth / 2);

    ctx.fillStyle = "#343a40";
    ctx.beginPath();
    ctx.moveTo(topRoadLeft, horizonY);
    ctx.lineTo(topRoadRight, horizonY);
    ctx.lineTo(bottomRoadRight, canvas.height);
    ctx.lineTo(bottomRoadLeft, canvas.height);
    ctx.fill();

    frameCount++;
    if (frameCount % 60 === 0) {
        bombs.push({
            y: horizonY,
            roadPosition: Math.random(),
            speed: 2 + Math.random() * 2 
        });
    }

    for (let i = bombs.length - 1; i >= 0; i--) {
        let bomb = bombs[i];

        bomb.speed += 0.05;
        bomb.y += bomb.speed;

        let progress = (bomb.y - horizonY) / (canvas.height - horizonY);

        if (progress > 1.2) {
            bombs.splice(i, 1);
            continue;
        }

        let currentLeftEdge = topRoadLeft * (1 - progress) + bottomRoadLeft * progress;
        let currentRightEdge = topRoadRight * (1 - progress) + bottomRoadRight * progress;
        let bombSize = 10 + (120 * progress); 
        let bombX = currentLeftEdge + ((currentRightEdge - currentLeftEdge) * bomb.roadPosition) - (bombSize / 2);

        ctx.fillStyle = "red";
        ctx.fillRect(bombX, bomb.y - bombSize, bombSize, bombSize);

        if (progress > 0.9 && progress < 1.05) {
            let carCenterX = canvas.width / 2;
            let carHitboxWidth = 150; 

            if (bombX + bombSize > carCenterX - (carHitboxWidth / 2) && bombX < carCenterX + (carHitboxWidth / 2)) {
                ctx.fillStyle = "rgba(255, 0, 0, 0.4)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                bombs.splice(i, 1);
            }
        }
    }

    requestAnimationFrame(gameLoop);
}