const socket = io();

const params = new URLSearchParams(window.location.search);
const roomId = params.get("room");

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

    socket.emit("join-room", roomId);
}

socket.on("user-connected", userId => {
    createPeerConnection(userId, true);
});

socket.on("user-disconnected", userId => {
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
        // Verificar si ya tenemos un video para este usuario
        if (!remoteVideos[userId]) {
            const video = document.createElement("video");
            video.id = `video-${userId}`;
            video.srcObject = event.streams[0];
            video.autoplay = true;
            video.playsinline = true;
            videoGrid.appendChild(video);
            remoteVideos[userId] = video;
        }
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
