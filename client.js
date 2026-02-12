const socket = io();

const params = new URLSearchParams(window.location.search);
const roomId = params.get("room");

const localVideo = document.getElementById("localVideo");
const videoGrid = document.getElementById("videoGrid");

let localStream;
let peerConnections = {};

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
        const video = document.createElement("video");
        video.srcObject = event.streams[0];
        video.autoplay = true;
        video.playsinline = true;
        videoGrid.appendChild(video);
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

start();
