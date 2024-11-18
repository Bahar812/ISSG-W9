const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let registeredUsername = "";
let username = "";
const users = new Map();

// Generate RSA key pair for the client
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input;
    registeredUsername = input;
    console.log(`Welcome, ${username} to the chat`);

    socket.emit("registerPublicKey", {
      username,
      publicKey: publicKey.export({ type: "spki", format: "pem" }),
    });
    rl.prompt();

    rl.on("line", (message) => {
      if (message.trim()) {
        if ((match = message.match(/^!impersonate (\w+)$/))) {
          username = match[1];
          console.log(`Now impersonating as ${username}`);
        } else if (message.match(/^!exit$/)) {
          username = registeredUsername;
          console.log(`Now you are ${username}`);
        } else {
          // Sign the message with the private key
          const signature = crypto
            .sign("sha256", Buffer.from(message), privateKey)
            .toString("hex");

          socket.emit("message", { username, message, signature });
        }
      }
      rl.prompt();
    });
  });
});

socket.on("init", (keys) => {
  keys.forEach(([user, key]) => users.set(user, key));
  console.log(`\nThere are currently ${users.size} users in the chat`);
  rl.prompt();
});

socket.on("newUser", (data) => {
  const { username, publicKey } = data;
  users.set(username, publicKey);
  console.log(`${username} joined the chat`);
  rl.prompt();
});

socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage, signature } = data;

  if (senderUsername !== username) {
    // Verify the signature using the sender's public key
    const senderPublicKey = users.get(senderUsername);
    if (senderPublicKey) {
      const isVerified = crypto.verify(
        "sha256",
        Buffer.from(senderMessage),
        { key: senderPublicKey, type: "spki", format: "pem" },
        Buffer.from(signature, "hex")
      );

      if (isVerified) {
        console.log(`${senderUsername}: ${senderMessage}`);
      } else {
        console.log(`⚠️ WARNING: This user (${senderUsername}) is fake!`);
      }
    } else {
      console.log(`⚠️ WARNING: Public key for ${senderUsername} not found!`);
    }
    rl.prompt();
  }
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
