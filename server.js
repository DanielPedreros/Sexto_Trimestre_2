const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server);

app.use(express.static("public"));

io.on("connection", socket => {

    socket.on("join-room", roomId => {

        socket.join(roomId);

        socket.to(roomId).emit("user-connected", socket.id);

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

        socket.on("disconnect", () => {
            socket.to(roomId).emit("user-disconnected", socket.id);
        });

    });

});

server.listen(3000, () => {
    console.log("Servidor corriendo 🚀");
});
