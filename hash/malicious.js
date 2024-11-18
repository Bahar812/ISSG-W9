const http = require("http");
const socketIo = require("socket.io");
const crypto = require("crypto"); 

const server = http.createServer();
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);

  socket.on("message", (data) => {
    let { username, message } = data;

    message += " (sus?)";

    const hash = crypto.createHash("sha256").update(data.message).digest("hex");

    io.emit("message", { username, message, hash });
  });

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`Malicious server running on port ${port}`);
});
