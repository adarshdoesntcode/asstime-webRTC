
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

let socket = null
let webcamTracks
let peers_ConnectionIds = []
let peers_Connection = []
let remoteVidStream = []
let remoteAudStream = []
let rtp_video_senders = []
let rtp_audio_senders = []
let audio
let muted = true

const localVideoPlayer = document.querySelector(".localVideoPlayer");
const videoContainer = document.querySelector("#video-container");

const videoStates = { None: 0, Camera: 1, Screen: 2 };
let videoState = videoStates.None

// =======================================================================================

// ==================================SOCKET IO============================================
const init = ()=>{
  socket = io.connect()
 
  socket.on("connect", () => {
    if(socket.connected){
      if(displayName != "" && roomId != ""){
        socket.emit("userconnect", {
          displayName,
          roomId,
        })
      }
    }
  })

  socket.on("inform_others_about_me", async (data) => {
    try {
      addPeer(data.displayName, data.connectId)
      await createConnection(data.connectId)
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("inform_me_about_others", async (otherPeers) => {
    try {
      if (otherPeers) {
        for (let i = 0; i < otherPeers.length; i++) {
          addPeer(otherPeers[i].displayName, otherPeers[i].connectId)
          await createConnection(otherPeers[i].connectId)
        }
      }
    } catch (error) {
      console.log(error);
    }
  })

  socket.on('infrom_about_connection_end', (data)=>{
    document.getElementById(data.connectId).remove()
    closeConnection(data.connectId)
  })
  
  //-----"RECEIVE"  answer||offer||ICE from the server-------

  socket.on("SDP_Process", async (data) => {
    try {
      await clientProcess(data.message, data.from_connectId);
    } catch (error) {
      console.log(error);
    }
  })
}

init()

// ========================================================================================


  //-----"SEND"  answer||offer||ICE to the server-------

  const serverProcess = (data, to_connectId) => {
    socket.emit("SDP_Process", {
      message: data,
      to_connectId,
    });
  };


//-------------Add new Peer to the DOM----------

const addPeer = (displayName, connectId) => {
  const divText = `<video class="remoteVideoPlayer" id="v_${connectId}" autoplay playsinline muted></video>
                  <p>${displayName}</p>
                  <audio id="a_${connectId}" autoplay></audio>`;
  const videoDiv = document.createElement("div");
  videoDiv.setAttribute('id',connectId)
  videoDiv.classList.add("remoteVideo")
  videoDiv.innerHTML = divText;
  videoContainer.append(videoDiv);
  videoDiv.addEventListener("click", () => {
    document.getElementById(`v_${connectId}`).requestFullscreen();
  });
};
 
// ==================================PEER CONNECTION============================================


//---------------------------Created a new webRTC connection-----------------------------------

const createConnection = async (connectId) => {
  try {
    let peerConnection = new RTCPeerConnection(ICE);


    peerConnection.onnegotiationneeded = async (event) => {
      await createOffer(connectId)
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        serverProcess(
          JSON.stringify({
            icecandidate: event.candidate,
          }),
          connectId
        );
      }
    };



    //-------------"RECEIVE" remote VIDEO from other Peers----------

    peerConnection.ontrack = (event) => {
      console.log(event);
      if (!remoteVidStream[connectId]) {
        remoteVidStream[connectId] = new MediaStream();
      }
      if (!remoteAudStream[connectId]) {
        remoteAudStream[connectId] = new MediaStream();
      }

      if (event.track.kind == "video") {
        remoteVidStream[connectId].getVideoTracks().forEach((track) => {
          remoteVidStream[connectId].removeTrack(track);
        });
        remoteVidStream[connectId].addTrack(event.track);

        const remoteVideoPlayer = document.getElementById(`v_${connectId}`);
        remoteVideoPlayer.srcObject = null;
        remoteVideoPlayer.srcObject = remoteVidStream[connectId];
      }

    //-------------"RECEIVE" remote AUDIO from other Peers----------

      if (event.track.kind == "audio") {
        remoteAudStream[connectId].getAudioTracks().forEach((track) => {
          remoteAudStream[connectId].removeTrack(track);
        });
        remoteAudStream[connectId].addTrack(event.track);
        const remoteAudioPlayer = document.getElementById(`a_${connectId}`);
        remoteAudioPlayer.srcObject = null;
        remoteAudioPlayer.srcObject = remoteAudStream[connectId];
      }
    };

    peers_ConnectionIds[connectId] = connectId
    peers_Connection[connectId] = peerConnection

    if (videoState == videoStates.Camera || videoState == videoStates.Screen) {
      if (webcamTracks) {
        updateMediaSenders(webcamTracks, rtp_video_senders)
      }
    }

    if(!muted){
      if(audio){
        updateMediaSenders(audio, rtp_audio_senders)
      }
    }

    return peerConnection
  } catch (error) {
    console.log(error);
  }
}
//---------------------------------------------------------------------------------------


//-------------Create Offer------------------

const createOffer = async (connectId) => {
  try {
    const offer = await peers_Connection[connectId].createOffer();
    await peers_Connection[connectId].setLocalDescription(offer);

    serverProcess(
      JSON.stringify({
        offer: peers_Connection[connectId].localDescription,
      }),
      connectId
    );
  } catch (error) {
    console.log(error);
  }
}


//-----Process the answer||offer||ICE from other peers comming through the server-------

const clientProcess = async (message, from_connectId) => {
  try {
    message = JSON.parse(message);  

    if (message.answer) {  //ANSWER
      if(!peers_Connection[from_connectId].currentRemoteDescription){
        peers_Connection[from_connectId].setRemoteDescription(message.answer)
      }
    } else if (message.offer) { //OFFER
      if(!peers_Connection[from_connectId]){
        await createConnection(from_connectId)
      }

      await peers_Connection[from_connectId].setRemoteDescription(
        message.offer
      );
      if (!peers_Connection[from_connectId]) {
        await createConnection(from_connectId);
      }
      const answer = await peers_Connection[from_connectId].createAnswer();
      await peers_Connection[from_connectId].setLocalDescription(answer);

      serverProcess(
        JSON.stringify({
          answer: answer,
        }),
        from_connectId
      );
    } else if (message.icecandidate) { //ICECANDIDATE
      if (!peers_Connection[from_connectId]) {
        await createConnection(from_connectId);
      }
      try {
        peers_Connection[from_connectId].addIceCandidate(message.icecandidate);
      } catch (error) {
        console.log(error);
      }
    }
  } catch (error) {
    console.log(error);
  }
};

// ==========================================================================================

// ==================================HANDLE STREAM============================================

const removeMediaSenders = (rtp_senders)=>{
  for(let id in peers_ConnectionIds){
    if(rtp_senders[id] && checkConnection(peers_Connection[id])){
      peers_Connection[id].removeTrack(rtp_senders[id])
      rtp_senders[id] = null 
    }
  }
}


const removeVidStream = (rtp_video_senders)=>{
  if(webcamTracks){
    webcamTracks.stop()
    webcamTracks = null
    localVideoPlayer.srcObject = null
    removeMediaSenders(rtp_video_senders)
  }  
}

const loadAudio = async()=>{
  try {
    let localAudioStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    })

    audio = localAudioStream.getAudioTracks()[0]
    audio.enabled = false

  } catch (error) {
    console.log(error)
  }
}


//-------------Add local video to the DOM----------

const videoProcess = async (newVideoState) => {
  if(newVideoState == videoStates.None){
    videoState = newVideoState

    removeVidStream(rtp_video_senders)
    return
  }

  try {
    let localVideoStream = null
    if (newVideoState == videoStates.Camera) {
      localVideoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    }
    if (newVideoState == videoStates.Screen) {
      localVideoStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    }

    if (localVideoStream && localVideoStream.getVideoTracks().length > 0) {
      webcamTracks = localVideoStream.getVideoTracks()[0];

      if (webcamTracks) {
        localVideoPlayer.srcObject = new MediaStream([webcamTracks]);
        updateMediaSenders(webcamTracks, rtp_video_senders);

        videoState = newVideoState;
      }
    }
  } catch (error) {
    console.log(error)
  }
};


//-------------"SEND" local video and audio to other Peers----------

const updateMediaSenders = async (track, rtp_senders) => {
  try {
    for (let id in peers_ConnectionIds) {
      if (checkConnection(peers_Connection[id])) {
        if (rtp_senders[id] && rtp_senders[id].track) {
          rtp_senders[id].replaceTrack(track);
        } else {
          rtp_senders[id] = peers_Connection[id].addTrack(track);
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
};

const checkConnection = async (connection) => {
  try {
    if (
      (connection && connection.conectionState == "new") ||
      connection.conectionState == "connecting" ||
      connection.conectionState == "connected"
    ) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.log(error);
  }
};


// ============================================================================================

// ==================================EVENT HANDLERS============================================


const micButton = document.querySelector(".fa-microphone");
micButton.addEventListener("click", async () => {
  if (!audio) {
    await loadAudio();
  }
  if (!audio) {
    alert("audio error");
    return;
  }
  if (muted) {
    audio.enabled = true;
    micButton.classList.add("active");
    updateMediaSenders(audio, rtp_audio_senders);
  } else {
    audio.enabled = false;
    micButton.classList.remove("active");
    removeMediaSenders(rtp_audio_senders);
  }
  muted = !muted;
});

const videoButton = document.querySelector(".fa-video");
videoButton.addEventListener("click", async () => {
  {
    if (videoState == videoStates.Camera) {
      await videoProcess(videoStates.None);
      videoButton.classList.remove("active");
    } else {
      await videoProcess(videoStates.Camera);
      videoButton.classList.add("active");
    }
  }
});

const screenButton = document.querySelector(".fa-tv");
screenButton.addEventListener("click", async () => {
  {
    if (videoState == videoStates.Screen) {
      await videoProcess(videoStates.None);
      screenButton.classList.remove("active");
    } else {
      await videoProcess(videoStates.Screen);
      screenButton.classList.add("active");
    }
  }
});


// ==========================================================================================


const closeConnection = async(connectId)=>{
  peers_ConnectionIds[connectId] =null
  if(peers_Connection[connectId]){
    peers_Connection[connectId].close()
    peers_Connection[connectId] = null
  }

  if(remoteAudStream[connectId]){
    remoteAudStream[connectId].getTrack().forEach( t => {
      t.stop()
    })

    remoteAudStream[connectId] = null
  }

  if(remoteVidStream[connectId]){
    remoteVidStream[connectId].getTrack().forEach( t => {
      t.stop()
    })

    remoteVidStream[connectId] = null
  }
}