const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let targetUsername = "";
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
    console.log(`Welcome, ${username} to the chat`);

    // Register the user's public key with the server
    socket.emit("registerPublicKey", {
      username,
      publicKey: publicKey.export({ type: "spki", format: "pem" }),
    });
    rl.prompt();

    rl.on("line", (message) => {
      if (message.trim()) {
        if ((match = message.match(/^!secret (\w+)$/))) {
          targetUsername = match[1];
          console.log(`Now secretly chatting with ${targetUsername}`);
        } else if (message.match(/^!exit$/)) {
          console.log(`No more secretly chatting with ${targetUsername}`);
          targetUsername = "";
        } else {
          // Encrypt the message if a target username is set
          let encryptedMessage = message;
          if (targetUsername) {
            const targetPublicKey = users.get(targetUsername);
            if (targetPublicKey) {
              encryptedMessage = crypto
                .publicEncrypt(
                  {
                    key: targetPublicKey,
                    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                  },
                  Buffer.from(message)
                )
                .toString("base64");
            } else {
              console.log(`⚠️ No public key found for ${targetUsername}`);
              rl.prompt();
              return;
            }
          }

          // Send the encrypted message
          socket.emit("message", { username, message: encryptedMessage });
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
  const { username: senderUsername, message: senderMessage } = data;

  if (senderUsername !== username) {
    let decryptedMessage = senderMessage;

    // Attempt to decrypt the message if it might be intended for this user
    try {
      decryptedMessage = crypto
        .privateDecrypt(
          {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          },
          Buffer.from(senderMessage, "base64")
        )
        .toString("utf8");
    } catch (err) {
      // Message could not be decrypted; leave as ciphertext
    }

    console.log(`${senderUsername}: ${decryptedMessage}`);
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
