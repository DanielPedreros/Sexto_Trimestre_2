const video = document.getElementById("localVideo");
const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");
const leaveBtn = document.getElementById("leaveBtn");

let stream;
let audioTrack;
let videoTrack;

async function startMedia() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        video.srcObject = stream;

        audioTrack = stream.getAudioTracks()[0];
        videoTrack = stream.getVideoTracks()[0];

    } catch (err) {
        alert("No se pudo acceder a la cámara/micrófono");
    }
}

muteBtn.onclick = () => {
    audioTrack.enabled = !audioTrack.enabled;
    muteBtn.classList.toggle("off");
    muteBtn.textContent = audioTrack.enabled ? "🎤" : "🔇";
};

cameraBtn.onclick = () => {
    videoTrack.enabled = !videoTrack.enabled;
    cameraBtn.classList.toggle("off");
    cameraBtn.textContent = videoTrack.enabled ? "📷" : "🚫";
};

leaveBtn.onclick = () => {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    alert("Saliste de la reunión");
};

startMedia();
