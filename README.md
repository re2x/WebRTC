


#XSockets.NET - WebRTC

This repo contains the full source code of the [XSockets.NET][1]  WebRTC (experiments)

##Pre-Req

In order to be able to use the XSockets.NET PeerBroker and the WebRTC JavaScript API's of ours. You need to install XSockets.NET into your application. Since you are going to have a web-application we recomend you to use MVC, but it is up to you.

Install XSockets.NET Realtime framework into your Visual Studio solution by using the [Nuget][2] package. 

Open the Package Manager console and type the following command.

    PM> Install-Package XSockets

##Testing WebRTC

 1. When installation is completed just add the files/folders found under the "src" catalog in this repo.
 2. Now make sure that XSockets will start when you start your project. To do this right click on your project and choose properties. Then go to the "Web" tab and choose "Use Visual Studio Development Server".
 3. Under the Client folder you will find a index.html file... Right click and choose "View In Browser"
 4. Open a few instances of chrome to the same URL and try it out.

To build your own conference solution is really easy. Consult the [XSockets.NET developer forum][1] for help and guidance.

**NOTE: Remember to use Chrome!** 

*To learn more about the WebRTC API, read the API-Guide below*

----------


  [1]: https://groups.google.com/forum/?hl=en#!forum/xsocketsgroup
  
##JavaScript API - Documentation

Here follows a brief description of the JavaScript API. 

###Create a PeerConnection
In order to create a PeerConnection (`XSockets.WebRTC`) you need a PeerBroker to broker connections.

    var broker = new XSockets.WebSocket("ws://localhost:4502/MyCustomBroker");
    broker.subscribe(XSockets.Events.open, function(brokerClient) {
     console.log("Broker Connected and client Created", brokerClient)
     
     // Create the PeerConnection ( XSockets.WebRTC object )
     
     rtc = new XSockets.WebRTC(broker);
    
     
    });
    
###Context Events
####OnContextCreated
This fires when you have a connection to the Broker controller

    rtc.bind(XSockets.WebRTC.Events.onContextCreated, function(ctx){
        console.log('OnContextCreated',ctx);
    });

####OnContextChange
This fires when something happens on the context. Someone joins or leaves! You will get a list of peers on the current context.

    rtc.bind(XSockets.WebRTC.Events.onContextChange, function(ctx){
        console.log('OnContextChange',ctx);
    });
###Context Methods
####Change Context
Changes your context on the broker. Pass in the Id of the context to join!

    rtc.changeContext(ctxId);
    
####Leave Context
Leave the current context... Hang up on all other peers
    
    rtc.leaveContext();

###Peer Events
####OnPeerConnectionStarted
Fires when the client starts to negotiate with the server

    rtc.bind(XSockets.WebRTC.Events.onPeerConnectionStarted, function(peer){
        console.log('OnPeerConnectionStarted',peer);
    });

####OnPeerConnectionCreated
Fires when the client has established a peer connectiond

    rtc.bind(XSockets.WebRTC.Events.onPeerConnectionCreated, function(peer){
        console.log('OnPeerConnectionCreated',peer);
    });

####OnPeerConnectionLost
Fires when a peer connection is lost (destroyed)

    rtc.bind(XSockets.WebRTC.Events.onPeerConnectionLost, function(peer){
        console.log('OnPeerConnectionLost',peer);
    });

###Peer Methods
####Remove Peer Connection
Lets you remove a connection from the current context.

    rtc.removePeerConnection(peerId,callback);
    
####Get Remote Peers
Get alist of peerId's on the current context
    
    rtc.getRemotePeers();
    
###MediaStream Methods
#### getUserMedia(constrints,success,failure)
Attach a local media stream ( camera / audio ) to the PeerConnection by calling `.getUserMedia(constrints,success,failure)`

    rtc.getUserMedia(rtc.userMediaConstraints.hd(true), function(result){
    
    console.log("MediaStream using HD constrints and audio is added to the PeerConnection"
    ,result);
    
    });

#### addMediaStream(mediaStream,callback)
If you want to a (external) media stream to the PeerConnection (local) call the `addMediaStream(mediaStream,callback)`

      window.getUserMedia(rtc.userMediaConstraints.qvga(false), function (stream) {
                         // Add the MediaStream capured
                         rtc.addLocalStream(stream, function () {
                         console.log("Added yet another media stream...");
                   });

#### removeStream(streamId)

To remove a local media stream from the PeerConnection and all connected remote peerconnection call the .removeStream(streamID) method

     rtc.removeStream(streamId, function(id) {
                             console.log("local stream removed", id);
                         });

#### refreshStreams(peerId,callback)

When a media stream is added by using the .getUserMedia or .addMediaStream event you need to call refreshStreams method to initialize a renegotiation.

    rtc.refreshStreams(peerId, function (id) {
        console.log("Streams refreshed and renegotiation is done..");
    });

** to get a list of all remote peerconnections call the .`getRemotePeers()` method.

####getLocalStreams()

To get a list of the peerconnection (clients ) media-streams call the `.getLocalStreams()` method

    var myLocalStreams = rtc.getLocalStreams();

###MediaStream Events
#### onLocalStream(event)

When a media stream is attached to the PeerConnection using `getUserMedia` och `addMediaStream` the API fires the `onLocalStream(stream)` event.

    rtc.bind(XSockets.WebRTC.Events.onLocalStream, function(stream) {
    
    // attach the stream to your <video> element or create a new <video> as you can add multiple streams to a PeerConnection
    
    });

#### onRemoteStream(event)

When a remote PeerConnection is connected the API fires the `onRemoteStream(event)` .

    rtc.bind(XSockets.WebRTC.Events.onRemoteSteam, function(event) {
       console.log(event);
       
       // event: {
       //  PeerId: 'Guid' // Identity if the RemotePeerConnection,
       //  stream: MediaStream
       //}
       
       // Attach the remote stream to a <video> an exisiting <video> element
       attachMediaStream(document.querySelector("#remoteVideo"), event.stream);
       
    });

#### onRemoteStreamLost

When a remote stream removes a stream (`.removeStream(mediaStreamId)`) the JavaScript API fires the `onRemoteStreamLost(streamId`) event

     rtc.bind(XSockets.WebRTC.Events.onRemoteStreamLost, function(event) {
        console.log("a remote peerconnection removed a stream", event);
         // remove video element by using the event.StreamID property
     });