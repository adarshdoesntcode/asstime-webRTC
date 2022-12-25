// ==================================CONSTANT DECLARATION================================
const ICE = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
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
  ],
};

const socket = io.connect();

const peers = {};

let localVideoStream = null;
let remoteVideoPlayer;
let remoteVidStream = new MediaStream();

const localVideoPlayer = document.querySelector(".localVideoPlayer");
const videoContainer = document.querySelector("#video-container");

// =======================================================================================

const callOtherPeers = (otherPeers, localVideoStream) => {
  otherPeers.forEach(async (otherpeer) => {
    // addPeerDiv(otherpeer.displayName,otherpeer.callerId)
    const peer = await createConnection(otherpeer.connectId);
    peers[otherpeer.connectId] = peer;
    localVideoStream.getTracks().forEach((track) => {
      peer.addTrack(track, localVideoStream);
    });
  });
};

// //-------------Add new Peer to the DOM----------

// const addPeerDiv = async(displayName, connectId) => {
//   const divText = `<video class="remoteVideoPlayer" id="v_${connectId}" autoplay playsinline></video>
//                   <p>${displayName}</p>`;
//   const videoDiv = document.createElement("div");
//   videoDiv.setAttribute('id',connectId)
//   videoDiv.classList.add("remoteVideo")
//   videoDiv.innerHTML = divText;
//   videoContainer.append(videoDiv)
// };

// ==================================PEER CONNECTION============================================

//---------------------------Created a new webRTC connection-----------------------------------

const createConnection = async (connectId) => {
  try {
    const peerConnection = new RTCPeerConnection(ICE);

    peerConnection.onnegotiationneeded = async (event) => {
      await createOffer(peerConnection, connectId);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        handleIceCandidateEvent(event);
      }
    };

    peerConnection.ontrack = (event) => {
      if (!document.getElementById(connectId)) {
        const div = document.createElement("div");
        div.classList.add("remoteVideo");
        div.setAttribute("id", connectId);
        const videoPlayer = document.createElement("video");
        videoPlayer.autoplay = true;
        videoPlayer.playsInline = true;
        videoPlayer.classList.add("remoteVideoPlayer");
        videoPlayer.setAttribute("id", `v_${connectId}`);

        div.append(videoPlayer);
        videoContainer.append(div);
      }

      remoteVideoPlayer = document.getElementById(`v_${connectId}`);
      if (remoteVideoPlayer) {
        remoteVideoPlayer.srcObject = event.streams[0];
      }
    };

    peerConnection.addEventListener("iceconnectionstatechange", (event) => {
      if (peerConnection.iceConnectionState === "failed") {
        console.log("Failed ",event);
        peerConnection.restartIce();
      }
    });
    return peerConnection;
  } catch (error) {
    console.log(error);
  }
};

//-------------Create Offer------------------

const createOffer = async (peer, idtoCall) => {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  const payload = {
    SDP: peer.localDescription,
    idtoCall,
  };

  socket.emit("connection_offer", payload);
};

const handleOffer = async ({ SDP, callerId }, localVideoStream) => {
  const peer = await createConnection(callerId);
  peers[callerId] = peer;
  const desc = new RTCSessionDescription(SDP);
  peer.setRemoteDescription(desc);

  localVideoStream.getTracks().forEach((track) => {
    peer.addTrack(track, localVideoStream);
  });

  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  const payload = {
    SDP: peer.localDescription,
    idtoAnswer: callerId,
  };

  socket.emit("connection_answer", payload);
};

const handleAnswer = async ({ SDP, answererId }) => {
  try {
    const desc = new RTCSessionDescription(SDP);
    await peers[answererId].setRemoteDescription(desc);
  } catch (error) {
    console.log(error);
  }
};

const handleIceCandidateEvent = async (event) => {
  Object.keys(peers).forEach((id) => {
    const payload = {
      idtoSend: id,
      candidate: event.candidate,
    };
    socket.emit("ice-candidate", payload);
  });
};

const handleICE = ({ candidate, from }) => {
  const incomingCandidate = new RTCIceCandidate(candidate);
  peers[from].addIceCandidate(incomingCandidate);
};


const handleDisconnect = (connectId)=> {
  delete peers[connectId];
  document.getElementById(connectId).remove();
};

// ==========================================================================================

// ==================================HANDLE STREAM============================================

// ============================================================================================

// ==================================EVENT HANDLERS============================================
const leave = document.querySelector(".fa-arrow-right-from-bracket");
const micButton = document.querySelector(".fa-microphone");
const videoButton = document.querySelector(".fa-video");
// const screenButton = document.querySelector(".fa-tv");

leave.addEventListener("click", async () => {
  if (confirm("You wanna dip?")) {
    videoContainer.innerHTML = '<h2><br><br><br><br><br>You dipped the room !!</h2>'
    localVideoStream.getTracks().forEach((track)=> {
      track.stop();
    });
    window.history.replaceState({}, document.title, "/" + "");
    document.querySelector('.controls').remove()
    socket.emit('leave_room')
  }
});

micButton.addEventListener("click", async () => {
  const audioTrack = localVideoStream
    .getTracks()
    .find((track) => track.kind === "audio");
  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    micButton.classList.remove("active");
  } else {
    audioTrack.enabled = true;
    micButton.classList.add("active");
  }
});

videoButton.addEventListener("click", async () => {
  const videoTrack = localVideoStream
    .getTracks()
    .find((track) => track.kind === "video");
  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    videoButton.classList.remove("active");
  } else {
    videoTrack.enabled = true;
    videoButton.classList.add("active");
  }
});

// screenButton.addEventListener("click", async () => {

// });

// ==========================================================================================

// ==================================SOCKET IO============================================
const init = () => {
  socket.on("connect", async () => {
    localVideoStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideoPlayer.srcObject = localVideoStream;

    if (socket.connected) {
      if (displayName != "" && roomId != "") {
        socket.emit("userconnect", {
          displayName,
          roomId,
        });
      }
    }

    socket.on("inform_others_about_me", (otherPeers) =>
      callOtherPeers(otherPeers, localVideoStream)
    );
    socket.on("connection_offer", (payload) =>
      handleOffer(payload, localVideoStream)
    );
    socket.on("connection_answer", (payload) => handleAnswer(payload));
    socket.on("ice-candidate", (payload) => handleICE(payload));
    socket.on('user_disconnected', (connectId) => handleDisconnect(connectId));
  });
};

init();

// ========================================================================================
