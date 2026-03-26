let volant = document.querySelector('.buggatiroyale_wheel');
let canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let currentRotation = 0;
let roadShiftX = 0;
let forwardSpeedY = 0;

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

    ctx.fillStyle = "#343a40";
    ctx.beginPath();
    ctx.moveTo(horizonX - (roadTopWidth / 2), horizonY);
    ctx.lineTo(horizonX + (roadTopWidth / 4), horizonY);
    ctx.lineTo((canvas.width / 2) + (roadBottomWidth / 2), canvas.height);
    ctx.lineTo((canvas.width / 2) - (roadBottomWidth / 2), canvas.height);
    ctx.fill();
    ctx.fillStyle = "white";

    requestAnimationFrame(gameLoop);
}