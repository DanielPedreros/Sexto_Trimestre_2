const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server);

app.use(express.static("public"));

io.on("connection", socket => {

    socket.on("join-room", data => {

        // Accept either a simple roomId string or an object { roomId, name }
        let roomId = data;
        let name = "Invitado";
        if (typeof data === "object") {
            roomId = data.roomId;
            name = data.name || name;
        }

        socket.data.name = name;

        socket.join(roomId);

        socket.to(roomId).emit("user-connected", { id: socket.id, name: socket.data.name });

        socket.on("offer", data => {
            io.to(data.target).emit("offer", {
                offer: data.offer,
                sender: socket.id
            });
        });

        socket.on("answer", data => {
            io.to(data.target).emit("answer", {
                answer: data.answer,
                sender: socket.id
            });
        });

        socket.on("ice-candidate", data => {
            io.to(data.target).emit("ice-candidate", {
                candidate: data.candidate,
                sender: socket.id
            });
        });

        socket.on("camera-toggle", data => {
            // data: { roomId, isCameraOff }
            socket.to(data.roomId).emit("camera-toggled", {
                userId: socket.id,
                isCameraOff: data.isCameraOff,
                name: socket.data.name
            });
        });

        socket.on("disconnect", () => {
            socket.to(roomId).emit("user-disconnected", { id: socket.id, name: socket.data.name });
        });

    });

});

server.listen(3000, () => {
    console.log("Servidor corriendo 🚀");
});
