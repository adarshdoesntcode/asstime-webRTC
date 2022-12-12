const socket = io().connect('/')
const servers = {
  iceServers : [
    {
      urls:['stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']
    }
  ]
}

const videoGrid = document.getElementById('video-container')
let localVideo = document.createElement('video');
let localStream;
let remoteStream;
let peerConnection;



const init = async()=>{
  const UID = Math.floor(Math.random() * Date.now())

  localStream = await navigator.mediaDevices.getUserMedia({audio:true,video:true});
  addVideoStream(localVideo,localStream)

  // console.log(MemberID);
  socket.emit('join-room', ROOM_ID, UID)

  socket.on('user-connected', (userID)=>{
    handleUserJoined(userID);
  })

  socket.on('message-from-peer',(message,userID)=>{
    handleMessageFromPeer(message,userID);
  })

}

const handleMessageFromPeer = async(message, MemberID)=>{
  message = JSON.parse(message.text)
  
  if(message.type === "offer"){
    createAnswer(MemberID,message.offer);
  }
  if(message.type === "answer"){
    addAnswer(message.answer);
  }
  if(message.type === "candidate"){
    if(peerConnection){
      peerConnection.addIceCandidate(message.candidate);
    }
  }
}

const handleUserJoined = async (userID)=>{
  createOffer(userID)
}

let createOffer = async (userID)=>{
  await createPeerConnection(userID);
  let offer = await peerConnection.createOffer();

  await peerConnection.setLocalDescription(offer);

  socket.emit('send-message-to-peer', {text:JSON.stringify({'type':'offer','offer':offer})},userID)

}

const createPeerConnection = async(userID)=>{
  peerConnection = new RTCPeerConnection(servers);

  remoteStream = new MediaStream();
  let remoteVideo = document.createElement('video');
  // document.getElementById("user-2").srcObject = remoteStream;
  addVideoStream(remoteVideo,remoteStream)

  if(!localStream){
    localStream = await navigator.mediaDevices.getUserMedia({audio:true,video:true});
    // document.getElementById("user-1").srcObject = localStream;
    addVideoStream(localVideo,localStream)
  }

  localStream.getTracks().forEach((track)=>{
    peerConnection.addTrack(track,localStream);
  })

  peerConnection.ontrack = (event)=>{
    event.streams[0].getTracks().forEach((track)=>{
      remoteStream.addTrack(track)
    })
  }

  peerConnection.onicecandidate = async (event)=>{
    if(event.candidate){
      socket.emit('send-message-to-peer',{text:JSON.stringify({'type':'candidate','candidate':event.candidate})},userID)

    }
  }

}

let createAnswer = async(MemberID,offer)=>{
  await createPeerConnection(MemberID);

  await peerConnection.setRemoteDescription(offer);

  let answer = await peerConnection.createAnswer();

  await peerConnection.setLocalDescription(answer)
  socket.emit('send-message-to-peer',{text:JSON.stringify({'type':'answer','answer':answer})},MemberID)

}

let addAnswer = async (answer)=>{
  if(!peerConnection.currentRemoteDescription){
    peerConnection.setRemoteDescription(answer)
  }
}

const addVideoStream =   (video, stream) =>{
  video.autoplay =true
  video.playsInline = true
  video.setAttribute('webkit-playsinline', 'webkit-playsinline')
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  videoGrid.append(video)
}

init();
// let myPeer = new Peer(undefined,{
//   host: '/',
//   port: '3000',
//   path:'/peerjs'
// })

// const myVideo = document.createElement('video')
// myVideo.muted = true

// const peers ={}
// if (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia) {
//   navigator.mediaDevices.getUserMedia({
//     video: true,
//     audio: true
// }).then(stream => {
//   addVideoStream(myVideo, stream)

//   myPeer.on('call', call => {
//     // if(confirm('new user wants to join')){
//       call.answer(stream)
//       const video = document.createElement('video')
//       call.on('stream', userVideoStream => {
//         addVideoStream(video, userVideoStream)
//       })
//     // }
    
//   })

//   socket.on('user-connected', userId => {
//     connectToNewUser(userId, stream)
//   })
// })
// }else{
//   alert("can't render video.")
// }

// socket.on('user-disconnected', userId => {
//   if (peers[userId]){
//     console.log(userId)
//     peers[userId].close()
//   } 
// })

// myPeer.on('open', id => {
//   socket.emit('join-room', ROOM_ID, id)
// })

// const connectToNewUser = async(userId, stream) =>{
//   if(confirm('another ass wants to join')){
//   const call = await myPeer.call(userId, stream)
//   const video = document.createElement('video')
//   call.on('stream', userVideoStream => {
//     addVideoStream(video, userVideoStream)
//   })

//   call.on('close', () => {
//     video.remove()
//   })
  
//   peers[userId] = call
// }
// }


