
// ==================================CONSTANT DECLARATION================================
const ICE = {
  iceServers: [
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
};

let peerConnection;
let webcamTracks;
let peers_ConnectionIds = [];
let peers_Connection = [];
let remoteVidStream = [];
let remoteAudStream = [];
let rtp_video_senders = [];
let rtp_audio_senders = [];
let audio;
let muted = true;

const localVideoPlayer = document.querySelector(".localVideoPlayer");
const videoContainer = document.querySelector("#video-container");

const videoStates = { None: 0, Camera: 1, Screen: 2 };
let videoState = videoStates.None;

// =======================================================================================


// ==================================SOCKET IO============================================

const socket = io.connect();

socket.on("connect", () => {
  socket.emit("userconnect", {
    displayName,
    roomId,
  })
})

socket.on("inform_others_about_me", async (data) => {
  try {
    await createConnection(data.connectId)
    addPeer(data.displayName, data.connectId)
  } catch (error) {
    console.log(error)
  }
})

socket.on("inform_me_about_others", async (otherPeers) => {
  try {
    if (otherPeers) {
      for (let i = 0; i < otherPeers.length; i++) {
        await createConnection(otherPeers[i].connectId)
        addPeer(otherPeers[i].displayName, otherPeers[i].connectId)
      }
    }
  } catch (error) {
    console.log(error);
  }
})


//-----"RECEIVE"  answer||offer||ICE from the server-------

socket.on("SDP_Process", async (data) => {
  try {
    await clientProcess(data.message, data.from_connectId);
  } catch (error) {
    console.log(error);
  }
})

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
                  <audio id="a_${connectId}" muted autoplay></audio>`;
  const videoDiv = document.createElement("div");
  videoDiv.classList.add("remoteVideo");
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
    peerConnection = new RTCPeerConnection(ICE);

    peerConnection.onnegotiationneeded = async (event) => {
      await createOffer(connectId);
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


    if (videoState == videoStates.Camera || videoState == videoStates.Screen) {
      if (webcamTracks) {
        updateMediaSenders(webcamTracks, rtp_video_senders);
      }
    }

    peers_ConnectionIds[connectId] = connectId;
    peers_Connection[connectId] = peerConnection;

    return peerConnection;
  } catch (error) {
    console.log(error);
  }
}
//---------------------------------------------------------------------------------------


//-------------Create Offer------------------

const createOffer = async (connectId) => {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    serverProcess(
      JSON.stringify({
        offer: peerConnection.localDescription,
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
        console.log("peer",peers_Connection[from_connectId]);
        console.log("ice",message.icecandidate);

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

// ==================================VIDEO STREAM============================================


//-------------Add local video to the DOM----------

const videoProcess = async (newVideoState) => {
  let localVideoStream = null;
  try {
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
    return
  }
};


//-------------"SEND" local video and audio to other Peers----------

const updateMediaSenders = async (track, rtp_senders) => {
  try {
    for (let id in peers_Connection) {
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
