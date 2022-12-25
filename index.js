const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidv4 } = require("uuid");

app.set("view engine", "ejs");

app.use(express.static("public"));

const port = process.env.PORT || 6969;

app.get("/", (req, res) => {
  res.redirect(`/${uuidv4()}`);
});

app.get("/:room", (req, res) => {
  res.render("room", {
    roomId: req.params.room,
  });
});


io.on("connection", (socket) => {
  console.log(`SocketId: ${socket.id}`);

  socket.on("userconnect", (data) => {
    console.log(data);

    const room = io.sockets.adapter.rooms.get(data.roomId);

    console.log(room);

    const otherPeers = []

    if(room){
      room.forEach(id => {
        otherPeers.push({
          connectId:id,
          displayName:data.displayName
        })
      });
    }
    socket.join(data.roomId)

    socket.emit("inform_others_about_me", otherPeers);
  });

  socket.on('connection_offer', ({ SDP , idtoCall }) => {
    io.to(idtoCall).emit("connection_offer", { SDP, callerId: socket.id });
  });

  socket.on('connection_answer', ({ idtoAnswer, SDP }) => {
    io.to(idtoAnswer).emit('connection_answer', { SDP, answererId: socket.id }) 
  });

  socket.on('ice-candidate', ({ idtoSend, candidate }) => {
    io.to(idtoSend).emit('ice-candidate', { candidate, from: socket.id });
  });

  socket.on('disconnecting', () => {
    socket.rooms.forEach(room => {
        socket.to(room).emit('user_disconnected', socket.id);
    });
  }); 

  socket.on("leave_room",()=>{
    socket.rooms.forEach(room => {
      socket.to(room).emit('user_disconnected', socket.id);
  });
  })
});

server.listen(port, () => {
  console.log(`Server started on port ${port} 🚀`);
});
