const socket = io();

const params = new URLSearchParams(window.location.search);
const roomId = params.get("room");
const displayName = (params.get("name") || "Invitado").trim();

const localVideo = document.getElementById("localVideo");
const videoGrid = document.getElementById("videoGrid");
const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");
const leaveBtn = document.getElementById("leaveBtn");

let localStream;
let peerConnections = {};
let remoteVideos = {}; // Rastrear videos remotos por user
let isMuted = false;
let isCameraOff = false;

async function start() {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });

    localVideo.srcObject = localStream;

    // Mostrar nombre local
    const localNameEl = document.getElementById("localName");
    if (localNameEl) localNameEl.textContent = displayName;

    // Unir a la sala enviando también el nombre
    socket.emit("join-room", { roomId, name: displayName });
}

socket.on("user-connected", user => {
    const userId = (typeof user === "object" && user.id) ? user.id : user;
    const name = (typeof user === "object" && user.name) ? user.name : "Invitado";

    createPeerConnection(userId, true);
    createRemotePlaceholder(userId, name);
});

socket.on("user-disconnected", data => {
    const userId = (typeof data === "object" && data.id) ? data.id : data;

    // Cerrar la conexión peer
    if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
    }
    
    // Remover el video del usuario
    if (remoteVideos[userId]) {
        remoteVideos[userId].remove();
        delete remoteVideos[userId];
    }
});

socket.on("offer", async data => {
    const pc = createPeerConnection(data.sender, false);

    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", {
        answer,
        target: data.sender
    });
});

socket.on("answer", async data => {
    const pc = peerConnections[data.sender];
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
});

socket.on("ice-candidate", async data => {
    const pc = peerConnections[data.sender];
    if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

function createPeerConnection(userId, initiator) {

    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    peerConnections[userId] = pc;

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    pc.ontrack = event => {
        let container = remoteVideos[userId];
        let videoEl;

        if (container) {
            videoEl = container.querySelector('video');
        } else {
            // Si no existe contenedor, crear uno genérico
            const video = document.createElement("video");
            video.id = `video-${userId}`;
            video.autoplay = true;
            video.playsinline = true;

            const nameDiv = document.createElement('div');
            nameDiv.className = 'name-overlay';
            nameDiv.textContent = 'Invitado';

            container = document.createElement('div');
            container.className = 'video-container';
            container.id = `container-${userId}`;
            container.appendChild(video);
            container.appendChild(nameDiv);
            videoGrid.appendChild(container);

            remoteVideos[userId] = container;
            videoEl = video;
        }

        videoEl.srcObject = event.streams[0];
    };

    pc.onicecandidate = event => {
        if (event.candidate) {
            socket.emit("ice-candidate", {
                candidate: event.candidate,
                target: userId
            });
        }
    };

    if (initiator) {
        pc.createOffer().then(offer => {
            pc.setLocalDescription(offer);
            socket.emit("offer", {
                offer,
                target: userId
            });
        });
    }

    return pc;
}

// Event listeners para controles
muteBtn.addEventListener("click", toggleMute);
cameraBtn.addEventListener("click", toggleCamera);
leaveBtn.addEventListener("click", leaveCall);

function toggleMute() {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        isMuted = !isMuted;
        muteBtn.style.background = isMuted ? "#d32f2f" : "#3c4043";
        muteBtn.textContent = isMuted ? "🔇" : "🎤";
    }
}

function toggleCamera() {
    if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        videoTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        isCameraOff = !isCameraOff;
        cameraBtn.style.background = isCameraOff ? "#d32f2f" : "#3c4043";
        cameraBtn.textContent = isCameraOff ? "📷❌" : "📷";
        // Mostrar overlay local cuando cámara apagada
        const localContainer = document.getElementById('localContainer');
        if (localContainer) {
            if (isCameraOff) localContainer.classList.add('camera-off');
            else localContainer.classList.remove('camera-off');
        }

        // Informar a otros peers
        socket.emit('camera-toggle', { roomId, isCameraOff });
    }
}

function leaveCall() {
    // Detener todos los tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    // Cerrar todas las peer connections
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};

    // Desconectar socket
    socket.disconnect();

    // Redirigir a página de inicio
    window.location.href = "/";
}

start();

// Crear placeholder remoto con nombre (si se conoce antes del track)
function createRemotePlaceholder(userId, name) {
    if (remoteVideos[userId]) return;

    const video = document.createElement("video");
    video.id = `video-${userId}`;
    video.autoplay = true;
    video.playsinline = true;

    const nameDiv = document.createElement('div');
    nameDiv.className = 'name-overlay';
    nameDiv.textContent = name || 'Invitado';

    const container = document.createElement('div');
    container.className = 'video-container';
    container.id = `container-${userId}`;
    container.appendChild(video);
    container.appendChild(nameDiv);

    videoGrid.appendChild(container);
    remoteVideos[userId] = container;
}

// Recibir notificación cuando otro usuario apaga/enciende su cámara
socket.on('camera-toggled', data => {
    const userId = data.userId;
    const isOff = data.isCameraOff;
    const container = remoteVideos[userId];
    if (container) {
        if (isOff) container.classList.add('camera-off');
        else container.classList.remove('camera-off');
    }
});
