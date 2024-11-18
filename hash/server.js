const http = require("http");
const socketIo = require("socket.io");
const crypto = require("crypto"); // For hashing

const server = http.createServer();
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);

  socket.on("message", (data) => {
    const { username, message } = data;

    // Create hash of the message
    const hash = crypto.createHash("sha256").update(message).digest("hex");

    // Broadcast message along with its hash
    io.emit("message", { username, message, hash });
  });

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
