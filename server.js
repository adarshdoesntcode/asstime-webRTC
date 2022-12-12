const express = require('express')
const app = express()
// const { ExpressPeerServer } = require('peer')
const server = require('http').Server(app)
const io = require('socket.io')(server)
const {v4:uuidv4} = require('uuid')

app.set('view engine' ,'ejs')
app.use(express.static('public'))
// const peerServer = ExpressPeerServer(server,{
//   debug:true,
//   port: 3000
// })

// app.use('/peerjs',peerServer)

const port = process.env.PORT || 3000

app.get('/',(req,res)=>{
  res.redirect(`/${uuidv4()}`)
})

app.get('/:room',(req,res)=>{
  res.render('room',{
    roomID:req.params.room
  })
})

io.on('connection',socket=>{
  socket.on('join-room',(roomID,userID)=>{
    socket.join(roomID)
    socket.to(roomID).emit('user-connected',userID)

    socket.on('send-message-to-peer',(data,id)=>{
      socket.broadcast.to(roomID).emit('message-from-peer',data,id)
    })
    // console.log(userID);
    socket.on('disconnect', () => {
      socket.to(roomID).emit('user-disconnected', userID)
    })
  })
})

server.listen(port,()=>{
  console.log('Server started 🚀',port)
})

