
// ==================================CONSTANT DECLARATION================================
const ICE = {
  iceServers: [
    {
      urls:['stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']
    },
    {
      urls: "stun:relay.metered.ca:80",
    },
    {
      urls: "turn:relay.metered.ca:80",
      username: "40af9eba614baed87dbab437",
      credential: "LMuAOvhUOAIGDOdt",
    },
    {
      urls: "turn:relay.metered.ca:443",
      username: "40af9eba614baed87dbab437",
      credential: "LMuAOvhUOAIGDOdt",
    },
    {
      urls: "turn:relay.metered.ca:443?transport=tcp",
      username: "40af9eba614baed87dbab437",
      credential: "LMuAOvhUOAIGDOdt",
    },
]
}

const socket = io.connect()

const peers = {}

let localVideoStream = null
let  remoteVideoPlayer
// let webcamTracks
// let peers_ConnectionIds = []
// let peers_Connection = []
let remoteVidStream = new MediaStream()
// let remoteAudStream = []
// let rtp_video_senders = []
// let rtp_audio_senders = []
// let audio
// let muted = true

const localVideoPlayer = document.querySelector(".localVideoPlayer");
const videoContainer = document.querySelector("#video-container");

// const videoStates = { None: 0, Camera: 1, Screen: 2 };
// let videoState = videoStates.None

// =======================================================================================

const callOtherPeers =  (otherPeers, localVideoStream)=> {
  otherPeers.forEach(async(otherpeer) => {
      // addPeerDiv(otherpeer.displayName,otherpeer.callerId)
      const peer = await createConnection(otherpeer.connectId);
      peers[otherpeer.connectId] = peer;
      localVideoStream.getTracks().forEach(track => {
        peer.addTrack(track, localVideoStream);
      });

  });
}



  //-----"SEND"  answer||offer||ICE to the server-------

  // const serverProcess = (data, to_connectId) => {
  //   socket.emit("SDP_Process", {
  //     message: data,
  //     to_connectId,
  //   });
  // };


//-------------Add new Peer to the DOM----------

const addPeerDiv = async(displayName, connectId) => {
  const divText = `<video class="remoteVideoPlayer" id="v_${connectId}" autoplay playsinline></video>
                  <p>${displayName}</p>`;
  const videoDiv = document.createElement("div");
  videoDiv.setAttribute('id',connectId)
  videoDiv.classList.add("remoteVideo")
  videoDiv.innerHTML = divText;
  videoContainer.append(videoDiv)
};
 
// ==================================PEER CONNECTION============================================


//---------------------------Created a new webRTC connection-----------------------------------

const createConnection = async (connectId) => {
  try {
    const peerConnection = new RTCPeerConnection(ICE);


    peerConnection.onnegotiationneeded = async (event) => {
      await createOffer(peerConnection,connectId)
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        handleIceCandidateEvent(event)
      }
    };

    peerConnection.ontrack = (event) => {
      if(!document.getElementById(connectId)){
        const div = document.createElement('div')
        div.classList.add("remoteVideo")
        div.setAttribute('id',connectId)
        const videoPlayer = document.createElement('video')
        videoPlayer.autoplay = true;
        videoPlayer.playsInline = true;
        videoPlayer.classList.add('remoteVideoPlayer');
        videoPlayer.setAttribute('id',`v_${connectId}`)

        div.append(videoPlayer)
        videoContainer.append(div)
      }


      console.log(event);
      // event.streams[0].getTracks().forEach((track)=>{
      //   remoteVidStream.addTrack(track)
      // })
      remoteVideoPlayer = document.getElementById(`v_${connectId}`);
      // videoPlayer.srcObject = null
      if(remoteVideoPlayer){
        remoteVideoPlayer.srcObject =  event.streams[0]
      }

    };
    console.log(peerConnection);
    return peerConnection
  } catch (error) {
    console.log(error);
  }
}


    //-------------"RECEIVE" remote VIDEO from other Peers----------

    // peerConnection.ontrack = (event) => {
    //   console.log(event);
    //   if (!remoteVidStream[connectId]) {
    //     remoteVidStream[connectId] = new MediaStream();
    //   }

    //   event.streams[0].getTracks().forEach((track)=>{
    //     remoteVidStream[connectId].addTrack(track)
    //   })
      // if (!remoteAudStream[connectId]) {
      //   remoteAudStream[connectId] = new MediaStream();
      // }

      // if (event.track.kind == "video") {
      //   remoteVidStream[connectId].getVideoTracks().forEach((track) => {
      //     remoteVidStream[connectId].removeTrack(track);
      //   });
      //   remoteVidStream[connectId].addTrack(event.track);

        // const remoteVideoPlayer = document.getElementById(`v_${connectId}`);
        // remoteVideoPlayer.srcObject = null;
        // remoteVideoPlayer.srcObject = remoteVidStream[connectId];
      // }

    //-------------"RECEIVE" remote AUDIO from other Peers----------

      // if (event.track.kind == "audio") {
      //   remoteAudStream[connectId].getAudioTracks().forEach((track) => {
      //     remoteAudStream[connectId].removeTrack(track);
      //   });
      //   remoteAudStream[connectId].addTrack(event.track);
      //   const remoteAudioPlayer = document.getElementById(`a_${connectId}`);
      //   remoteAudioPlayer.srcObject = null;
      //   remoteAudioPlayer.srcObject = remoteAudStream[connectId];
      // }
    // };

    // peers_ConnectionIds[connectId] = connectId
    // peers_Connection[connectId] = peerConnection

    // if (videoState == videoStates.Camera || videoState == videoStates.Screen) {
    //   if (localVideoStream) {
    //    await updateMediaSenders(localVideoStream, rtp_video_senders)
    //   }
    // }

    // if(!muted){
    //   if(audio){
    //     await updateMediaSenders(audio, rtp_audio_senders)
    //   }
    // }


//---------------------------------------------------------------------------------------


//-------------Create Offer------------------

const createOffer = async (peer,idtoCall) => {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  const payload = {
      SDP: peer.localDescription,
      idtoCall,
  };

  socket.emit('connection_offer', payload);
}

const handleOffer = async({ SDP, callerId }, localVideoStream)=> {
  const peer = await createConnection(callerId);
  peers[callerId] = peer;
  const desc = new RTCSessionDescription(SDP);
   peer.setRemoteDescription(desc);

  localVideoStream.getTracks().forEach(track => {
    peer.addTrack(track, localVideoStream);
  });

  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  const payload = {
      SDP: peer.localDescription,
      idtoAnswer: callerId
  };

  socket.emit('connection_answer', payload);
}

const handleAnswer = async({ SDP, answererId }) => {
  try {
    const desc = new RTCSessionDescription(SDP);
    await peers[answererId].setRemoteDescription(desc)   
  } catch (error) {
    console.log(error);
  }
}

const handleIceCandidateEvent = async(event) =>{
  Object.keys(peers).forEach(id => {
    const payload = {
        idtoSend: id,
        candidate: event.candidate,
    }
    socket.emit("ice-candidate", payload);
});
}

const handleICE = ({ candidate, from }) => {
  const incomingCandidate = new RTCIceCandidate(candidate);
  peers[from].addIceCandidate(incomingCandidate);
};

//-----Process the answer||offer||ICE from other peers comming through the server-------

// const clientProcess = async (message, from_connectId) => {
//   try {
//     message = JSON.parse(message);  

//     if (message.answer) {  //ANSWER
//       if(!peers_Connection[from_connectId].currentRemoteDescription){
//         peers_Connection[from_connectId].setRemoteDescription(message.answer)
//       }
//     } else if (message.offer) { //OFFER
//       if(!peers_Connection[from_connectId]){
//         await createConnection(from_connectId)
//       }

//       await peers_Connection[from_connectId].setRemoteDescription(
//         message.offer
//       );

//       // localVideoStream.getTracks().forEach(track => {
//       //   peers_Connection[from_connectId].addTrack(track, localVideoStream);
//       // });

//       if (!peers_Connection[from_connectId]) {
//         await createConnection(from_connectId);
//       }
//       const answer = await peers_Connection[from_connectId].createAnswer();
//       await peers_Connection[from_connectId].setLocalDescription(answer);

//       serverProcess(
//         JSON.stringify({
//           answer: answer,
//         }),
//         from_connectId
//       );
//     } else if (message.icecandidate) { //ICECANDIDATE
//       if (!peers_Connection[from_connectId]) {
//         await createConnection(from_connectId);
//       }
//       try {
//         peers_Connection[from_connectId].addIceCandidate(message.icecandidate);
//       } catch (error) {
//         console.log(error);
//       }
//     }
//   } catch (error) {
//     console.log(error);
//   }
// };

// ==========================================================================================

// ==================================HANDLE STREAM============================================

// const removeMediaSenders = (rtp_senders)=>{
//   for(let id in peers_ConnectionIds){
//     if(rtp_senders[id] && checkConnection(peers_Connection[id])){
//       peers_Connection[id].removeTrack(rtp_senders[id])
//       rtp_senders[id] = null 
//     }
//   }
// }


// const removeVidStream = (rtp_video_senders)=>{
//   if(webcamTracks){
//     webcamTracks.stop()
//     webcamTracks = null
//     localVideoPlayer.srcObject = null
//     removeMediaSenders(rtp_video_senders)
//   }  
// }

// const loadAudio = async()=>{
//   try {
//     let localAudioStream = await navigator.mediaDevices.getUserMedia({
//       video: false,
//       audio: true,
//     })

//     audio = localAudioStream.getAudioTracks()[0]
//     audio.enabled = false

//   } catch (error) {
//     console.log(error)
//   }
// }


//-------------Add local video to the DOM----------

// const videoProcess = async (newVideoState) => {
//   if(newVideoState == videoStates.None){
//     videoState = newVideoState

//     removeVidStream(rtp_video_senders)
//     return
//   }

//   try {
    
//     if (newVideoState == videoStates.Camera) {
//       localVideoStream = await navigator.mediaDevices.getUserMedia({
//         video: true,
//         audio: true,
//       });
//       localVideoPlayer.classList.add('flipped')

//     }
//     if (newVideoState == videoStates.Screen) {
//       localVideoStream = await navigator.mediaDevices.getDisplayMedia({
//         video: true,
//         audio: false,
//       });
//       localVideoPlayer.classList.remove('flipped')
//     }

//     if (localVideoStream && localVideoStream.getVideoTracks().length > 0) {
//       webcamTracks = localVideoStream.getVideoTracks()[0];

//       if (webcamTracks) {
//         // localVideoPlayer.srcObject = new MediaStream([webcamTracks]);
//         localVideoPlayer.srcObject = localVideoStream

//         updateMediaSenders(localVideoStream, rtp_video_senders);

//         videoState = newVideoState;
//       }
//     }
//   } catch (error) {
//     console.log(error)
//   }
// };


// //-------------"SEND" local video and audio to other Peers----------

// const updateMediaSenders = async (stream, rtp_senders) => {
//   try {
//     for (let id in peers_ConnectionIds) {
//       if (checkConnection(peers_Connection[id])) {
//         // if (rtp_senders[id] && rtp_senders[id].track) {
//         //   rtp_senders[id].replaceTrack(track);
//         // } else {
//         //   rtp_senders[id] = peers_Connection[id].addTrack(track);
//         // }

//         stream.getTracks().forEach(track => {
//           rtp_senders[id] = peers_Connection[id].addTrack(track, stream);
//       });
//       }
//     }
//   } catch (error) {
//     console.log(error);
//   }
// };

// const checkConnection = async (connection) => {
//   try {
//     if (
//       (connection && connection.conectionState == "new") ||
//       connection.conectionState == "connecting" ||
//       connection.conectionState == "connected"
//     ) {
//       return true;
//     } else {
//       return false;
//     }
//   } catch (error) {
//     console.log(error);
//   }
// };


// ============================================================================================

// ==================================EVENT HANDLERS============================================
const leave = document.querySelector('.fa-arrow-right-from-bracket')
const micButton = document.querySelector(".fa-microphone");
const videoButton = document.querySelector(".fa-video");
// const screenButton = document.querySelector(".fa-tv");

leave.addEventListener('click', async()=>{
  if(confirm('You wanna dip?')){
    await closeConnection(socket.id)
    close()
  }
})

micButton.addEventListener("click", async () => {
  const audioTrack = localVideoStream.getTracks().find(track => track.kind === 'audio');
  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    micButton.classList.remove('active')
  } else {
    audioTrack.enabled = true;
    micButton.classList.add('active')
  }
});

videoButton.addEventListener("click", async () => {
  const videoTrack = localVideoStream.getTracks().find(track => track.kind === 'video');
  if (videoTrack.enabled) {
      videoTrack.enabled = false;
      videoButton.classList.remove('active')
  } else {
      videoTrack.enabled = true;
      videoButton.classList.add('active')
  }
});

// screenButton.addEventListener("click", async () => {

// });


// ==========================================================================================


// const closeConnection = async(connectId)=>{
//   peers_ConnectionIds[connectId] =null
//   if(peers_Connection[connectId]){
//     peers_Connection[connectId].close()
//     peers_Connection[connectId] = null
//   }

//   if(remoteVidStream[connectId]){
//     remoteVidStream[connectId].getTrack().forEach( t => {
//       if(t.stop){
//         t.stop()
//       }
//     })

//     remoteVidStream[connectId] = null
//   }

//   if(remoteAudStream[connectId]){
//     remoteAudStream[connectId].getTrack().forEach( t => {
//       if(t.stop){
//         t.stop()
//       }
//     })

//     remoteAudStream[connectId] = null
//   }
 
// }

// ==================================SOCKET IO============================================
const init = ()=>{
 
  socket.on("connect", async() => {

    localVideoStream = await navigator.mediaDevices.getUserMedia({ video: true , audio:true});
    localVideoPlayer.srcObject = localVideoStream;


    if(socket.connected){
      if(displayName != '' && roomId != ""){
        socket.emit("userconnect", {
          displayName,
          roomId,
        })
      }
    }

    socket.on("inform_others_about_me", (otherPeers) => callOtherPeers(otherPeers, localVideoStream));
    socket.on("connection_offer", (payload) => handleOffer(payload, localVideoStream));
    socket.on('connection_answer',(payload) => handleAnswer(payload));
    socket.on('ice-candidate', (payload) => handleICE(payload));


    
  })



  // socket.on("inform_me_about_others", async (otherPeers) => {
  //   try {
  //     if (otherPeers) {
  //       for (let i = 0; i < otherPeers.length; i++) {
  //         addPeer(otherPeers[i].displayName, otherPeers[i].connectId)
  //         await createConnection(otherPeers[i].connectId)
  //         // localVideoStream.getTracks().forEach(track => {
  //         //   peers_Connection[otherPeers[i].connectId].addTrack(track, localVideoStream);
  //         // });
  //       }
  //     }
  //   } catch (error) {
  //     console.log(error);
  //   }
  // })

  // socket.on('infrom_about_connection_end', (data)=>{
  //   document.getElementById(data.connectId).remove()
  //   closeConnection(data.connectId)
  // })
  
  //-----"RECEIVE"  answer||offer||ICE from the server-------

  // socket.on("SDP_Process", async (data) => {
  //   try {
  //     await clientProcess(data.message, data.from_connectId);
  //   } catch (error) {
  //     console.log(error);
  //   }
  // })
}

init()

// ========================================================================================