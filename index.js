const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidv4 } = require("uuid");

app.set("view engine", "ejs");

app.use(express.static("public"));

const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.redirect(`/${uuidv4()}`);
});

app.get("/:room", (req, res) => {
  res.render("room", {
    roomId: req.params.room,
  });
});

let allConnections = [];
let otherPeers = [];

io.on("connection", (socket) => {
  console.log(`SocketId: ${socket.id}`);

  socket.on("userconnect", (data) => {
    console.log(data);

    otherPeers = allConnections.filter((ac) => ac.roomId == data.roomId);

    allConnections.push({
      connectId: socket.id,
      displayName: data.displayName,
      roomId: data.roomId,
    });

    otherPeers.forEach((p) => {
      socket.to(p.connectId).emit("inform_others_about_me", {
        connectId: socket.id,
        displayName: data.displayName,
      });
    });

    socket.on("SDP_Process", (data) => {
      socket.to(data.to_connectId).emit("SDP_Process", {
        message: data.message,
        from_connectId: socket.id,
      });
    });

    socket.emit("inform_me_about_others", otherPeers);

    socket.on("disconnect",()=>{
      console.log(socket.id + "disconnect");
      let disconnectPeer = allConnections.find(p => p.connectId == socket.id)

      if(disconnectPeer){
        let roomId = disconnectPeer.roomId
        allConnections = allConnections.filter(p => p.connectId != socket.id)

        let list = allConnections.filter(p => p.roomId == roomId)

        list.forEach( p => {
          socket.to(p.connectId).emit('infrom_about_connection_end',{
            connectId:socket.id
          } )
        })
      }
      
    })
  });


});

server.listen(port, () => {
  console.log(`Server started on port ${port} 🚀`);
});
