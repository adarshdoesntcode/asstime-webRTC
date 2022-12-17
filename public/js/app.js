const socket = io.connect()
const servers = {
  iceServers : [
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'}
  ]
}

let peerConnection
let webcamTracks
let localVideoStream 
let peers_ConnectionIds = []
let peers_Connection = []
const remoteVidStream = []
const remoteAudStream = []
let rtp_video_senders = []
let rtp_audio_senders = []
let audio
let muted = false

const localVideoPlayer = document.querySelector('.localVideoPlayer')
const videoContainer = document.querySelector('#video-container');

const videoStates = { None:0,Camera:1,Screen:2}
let videoState = videoStates.Camera

const init = async ()=>{
  try{
    const micButton = document.querySelector('.fa-microphone')
    micButton.addEventListener('click', async()=>{
      if(!audio){
        await loadAudio()
      }
      if(!audio){
        alert('audio error')
        return
      }
      if(muted){
        audio.enabled = true
        micButton.classList.add('active')
        updateMediaSenders(audio,rtp_audio_senders)
      }
      else{
        audio.enabled = false
        micButton.classList.remove('active')
        removeMediaSenders(rtp_audio_senders)
      }
      muted = !muted
    })
  
    const videoButton = document.querySelector('.fa-video')
    videoButton.addEventListener('click',async()=>{{
      if(videoState == videoStates.Camera){
        await videoProcess(videoStates.None)
        videoButton.classList.remove('acive')
      }
      else{
        await videoProcess(videoStates.Camera)
        videoButton.classList.add('acive')
      }
    }})
  
    const screenButton = document.querySelector('.fa-tv')
    screenButton.addEventListener('click',async()=>{{
      if(videoState == videoStates.Screen){
        await videoProcess(videoStates.None)
        screenButton.classList.remove('active')
      }
      else{
        await videoProcess(videoStates.Screen)
        screenButton.classList.add('active')
  
      }
    }})
  }catch(error){
    console.log(error);
  }
  
}

socket.on('connect',()=>{
  socket.emit('userconnect',{
    displayName,
    roomId
  })
})

socket.on('inform_others_about_me',async (data) => {
  try {
    addPeer(data.displayName,data.connectId)
    await createConnection(data.connectId)
    
  } catch (error) {
    console.log(error);
  }
})

socket.on('inform_me_about_others',async (otherPeers) => {

  try {
    if(otherPeers){
      for(let i = 0; i<otherPeers.length;i++){
        addPeer(otherPeers[i].displayName,otherPeers[i].connectId)
        await createConnection(otherPeers[i].connectId)
      }
    }
    
  } catch (error) {
    console.log(error);
  }
})

socket.on('SDP_Process',async (data) => {
  try{
    await clientProcess(data.message,data.from_connectId)  
  }catch(error){
    console.log(error);
  }
})

const addPeer = (displayName,connectId) => {
  const divText = `<video class="remoteVideoPlayer" id="v_${connectId}" autoplay playsinline muted></video>
                  <p>${displayName}</p>
                  <audio id="a_${connectId}" muted autoplay></audio>`
  const videoDiv = document.createElement('div')
  videoDiv.classList.add("remoteVideo");
  videoDiv.innerHTML = divText
  videoContainer.append(videoDiv)
}

const createConnection =async (connectId) => {
  try {
    peerConnection = new RTCPeerConnection(servers)

  peerConnection.onnegotiationneeded = async(event) => {
    await createOffer(connectId)
  }

  peerConnection.onicecandidate = event => {
    if(event.candidate){
      serverProcess(
        JSON.stringify({
          icecandidate:event.candidate
        }),
        connectId
      )
    }
  }

  peerConnection.ontrack = (event) => {
    console.log("event",event);
    if(!remoteVidStream[connectId]){
      remoteVidStream[connectId] = new MediaStream()
    }
    if(!remoteAudStream[connectId]){
      remoteAudStream[connectId] = new MediaStream()
    }

    if(event.track.kind == 'video'){
      remoteVidStream[connectId].getVideoTracks()
      .forEach( track => {
        remoteVidStream[connectId].removeTrack(track)
      })
      remoteVidStream[connectId].addTrack(event.track)

      const remoteVideoPlayer = document.getElementById(`v_${connectId}`)
      remoteVideoPlayer.srcObject = null
      remoteVideoPlayer.srcObject = remoteVidStream
      remoteVideoPlayer.addEventListener('loadedmetadata', () => {
        remoteVideoPlayer.play()
      })
    }

    if(event.track.kind == 'audio'){
      remoteAudStream[connectId].getAudioTracks()
      .forEach( track => {
        remoteAudStream[connectId].removeTrack(track)
      })
      remoteAudStream[connectId].addTrack(event.track)
      const remoteAudioPlayer = document.getElementById(`a_${connectId}`)
      remoteAudioPlayer.srcObject = null
      remoteAudioPlayer.srcObject = remoteAudStream[connectId]

      remoteAudioPlayer.addEventListener('loadedmetadata', () => {
        remoteAudioPlayer.play()
      })
    }
  }

  if(videoState == videoStates.Camera || videoState == videoStates.Screen){
    updateMediaSenders(webcamTracks,rtp_video_senders)
  }

  peers_ConnectionIds[connectId] = connectId
  peers_Connection[connectId] = peerConnection

  return peerConnection
  } catch (error) {
    console.log(error);
  }
}

const createOffer = async (connectId) => {

  try {
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)
  
    serverProcess(
      JSON.stringify({
        offer:peerConnection.localDescription
      }),
      connectId
    )
  } catch (error) {
    console.log(error);
  }
}

const serverProcess = (data, to_connectId) => { 
  socket.emit('SDP_Process',{
    message:data,
    to_connectId
  })
}

const clientProcess = async (message,from_connectId) => {
  try {
    message = JSON.parse(message)

    if(message.answer){
      await peers_Connection[from_connectId]
      .setRemoteDescription(new RTCSessionDescription(message.answer))
    }
    else if(message.offer){
      await peers_Connection[from_connectId]
      .setRemoteDescription(new RTCSessionDescription(message.offer))
      if(!peers_Connection[from_connectId]){
        await createConnection(from_connectId)
      }
      const answer = await peers_Connection[from_connectId]
      .createAnswer()
      await peers_Connection[from_connectId].setLocalDescription[answer]
  
      serverProcess(
        JSON.stringify({
          answer:answer
        }),
        from_connectId
      )
    }
    else if(message.icecandidate){
      if(!peers_Connection[from_connectId]){
        await createConnection(from_connectId)
      }
      try{
        peers_Connection[from_connectId]
        .addIceCandidate(message.icecandidate)
      }catch(error){
        console.log(error);
      }
    }
  } catch (error) {
    console.log(error);
  }
 
}

const videoProcess = async (newVideoState)=>{
  localVideoStream = null;
  try{
    if(newVideoState == videoStates.Camera){
      localVideoStream = navigator.mediaDevices.getUserMedia({
        video:true,
        audio:false
      })
    }
    if(newVideoState == videoStates.Screen){
      localVideoStream = navigator.mediaDevices.getDisplayMedia({
        video:true,
        audio:false
      })
    }

    // if(newVideoState == videoStates.None){
    //   localVideoStream = null
    // }

    if(localVideoStream &&  localVideoStream.getVideoTrack().length>0){
      webcamTracks = localVideoStream.getVideoTracks()[0]

      if(webcamTracks){
        localVideoPlayer.srcObject = new MediaStream([webcamTracks])
        localVideoPlayer.addEventListener('loadedmetadata', () => {
          localVideoPlayer.play()
        })

        await updateMediaSenders(localVideoStream,rtp_video_senders)
      }
    }
  }catch(error){
    console.log(error);
  }

  videoState = newVideoState
}

const updateMediaSenders = async (track,rtp_senders)=>{
  try {
    for(let id in peers_Connection){
      if(checkConnection(peers_Connection[id])){
        if(rtp_senders[id] && rtp_senders[id].track){
          rtp_senders[id].replaceTrack(track)
        }else{
          rtp_senders[id] = peers_Connection[id].addTrack(track)
        }
      }   
    }
  } catch (error) {
    console.log(error);
  }
}

const checkConnection = async(connection)=>{
  try {
    if(connection && connection.conectionState == 'new' ||
    connection.conectionState == 'connecting' ||
    connection.conectionState == 'connected'){
      return true
    }else{
      return false
    }
    
  } catch (error) {
    console.log(error);
  }
}

init();
// videoProcess(videoStates.Camera);


