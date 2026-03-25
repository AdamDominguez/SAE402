let volant = document.querySelector('.buggatiroyale_wheel');

window.addEventListener("click", handleClick, { once: true });

function handleClick() {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === "granted") {
                    window.addEventListener("deviceorientation", handleOrientation);
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener("deviceorientation", handleOrientation);
    }
}

function handleOrientation(event) {
    let rotation = event.gamma;
    volant.style.transform = `rotate(${rotation}deg)`;
}