const socket = io('/')
const videoGrid = document.getElementById('video-container')
let myPeer = new Peer(undefined,{
  host: '/',
  port: '443',
  path:'/peerjs'
})

const myVideo = document.createElement('video')
myVideo.muted = true
myVideo.autoplay =true
myVideo.playsInline = true
myVideo.setAttribute('webkit-playsinline', 'webkit-playsinline')

const peers ={}
if (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia ||
  navigator.msGetUserMedia) {
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  addVideoStream(myVideo, stream)

  myPeer.on('call', call => {
    call.answer(stream)
    const video = document.createElement('video')
    video.autoplay =true
    video.playsInline = true
    video.setAttribute('webkit-playsinline', 'webkit-playsinline')
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    })
  })

  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
  })
})
}else{
  alert("can't render video.")
}
socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close()
})

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream)
  const video = document.createElement('video')
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream)
  })
  call.on('close', () => {
    video.remove()
  })

  peers[userId] = call
}

function addVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  videoGrid.append(video)
}
