const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto"); 

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let username = "";

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input;
    console.log(`Welcome, ${username} to the chat`);
    rl.prompt();

    rl.on("line", (message) => {
      if (message.trim()) {
        // Send message to the server
        socket.emit("message", { username, message });
      }
      rl.prompt();
    });
  });
});

socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage, hash } = data;

  // Compute hash of the received message to verify integrity
  const computedHash = crypto.createHash("sha256").update(senderMessage).digest("hex");

  if (computedHash !== hash) {
    console.log(`⚠️ WARNING: The message from ${senderUsername} may have been altered during transmission!`);
  } else {
    console.log(`${senderUsername}: ${senderMessage}`);
  }

  rl.prompt();
});

socket.on("disconnect", () => {
  console.log("Server disconnected, Exiting...");
  rl.close();
  process.exit(0);
});

rl.on("SIGINT", () => {
  console.log("\nExiting...");
  socket.disconnect();
  rl.close();
  process.exit(0);
});
