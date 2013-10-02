var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;

if (navigator.mozGetUserMedia) {
    // thanx Adam Barth.
    webrtcDetectedBrowser = "firefox";
    RTCPeerConnection = mozRTCPeerConnection;
    RTCSessionDescription = mozRTCSessionDescription;

    RTCIceCandidate = mozRTCIceCandidate;


    getUserMedia = navigator.mozGetUserMedia.bind(navigator);

    attachMediaStream = function (element, stream) {
        element.mozSrcObject = stream;
        element.play();
    };

    reattachMediaStream = function (to, from) {
        to.mozSrcObject = from.mozSrcObject;
        to.play();
    };

    MediaStream.prototype.getVideoTracks = function () {
        return [];
    };

    MediaStream.prototype.getAudioTracks = function () {
        return [];
    };
} else if (navigator.webkitGetUserMedia) {
    webrtcDetectedBrowser = "chrome";

    RTCPeerConnection = webkitRTCPeerConnection;
    getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
    attachMediaStream = function (element, stream) {

        element.src = webkitURL.createObjectURL(stream);
    };

    reattachMediaStream = function (to, from) {
        to.src = from.src;
    };
    if (!webkitMediaStream.prototype.getVideoTracks) {
        webkitMediaStream.prototype.getVideoTracks = function () {
            return this.videoTracks;
        };
        webkitMediaStream.prototype.getAudioTracks = function () {
            return this.audioTracks;
        };
    }
    if (!webkitRTCPeerConnection.prototype.getLocalStreams) {
        webkitRTCPeerConnection.prototype.getLocalStreams = function () {
            return this.localStreams;
        };
        webkitRTCPeerConnection.prototype.getRemoteStreams = function () {
            return this.remoteStreams;
        };
    }
} else {

}

XSockets.PeerContext = function (guid, context) {
    this.PeerId = guid;
    this.Context = context;
};

XSockets.WebRTC = function (ws, settings) {

    var self = this;
    var localStreams = [];
    this.PeerConnections = {};
    this.DataChannels = {};

    var defaults = {
        RTCConfiguration: {
            "iceServers": [{
                "url": "stun:stun.l.google.com:19302"
            }]
        },
        MediaConstraints: {
            mandatory: {
                OfferToReceiveAudio: true,
                OfferToReceiveVideo: true
            },
            optional: [{
                RtpDataChannels: true
            }]
        },
        sdpExpressions: []
    };


    var options = XSockets.Utils.extend(defaults, settings);



    var Subscriptions = (function () {
        var subscriptions = [];
        this.add = function (name, fn, opt) {
            name = name.toLowerCase();
            var storedSub = this.get(name);
            if (storedSub === null) {
                var sub = new subscription(name);
                sub.addCallback(fn, opt);
                subscriptions.push(sub);
                return 1;
            }
            storedSub.addCallback(fn, opt);
            return storedSub.Callbacks.length;
        };
        this.get = function (name) {
            name = name.toLowerCase();
            for (var i = 0; i < subscriptions.length; i++) {
                if (subscriptions[i].Name === name) return subscriptions[i];
            }
            return null;
        };
        this.getAll = function () {
            return subscriptions;
        };
        this.remove = function (name, ix) {
            name = name.toLowerCase();
            for (var i = 0; i < subscriptions.length; i++) {
                if (subscriptions[i].Name === name) {
                    if (ix === undefined) {
                        subscriptions.splice(i, 1);
                    } else {
                        subscriptions[i].Callbacks.splice(ix - 1, 1);
                        if (subscriptions[i].Callbacks.length === 0) subscriptions.splice(i, 1);
                    }
                    return true;
                }
            }
            return false;
        };
        this.fire = function (name, message, cb, ix) {
            name = name.toLowerCase();
            for (var i = 0; i < subscriptions.length; i++) {
                if (subscriptions[i].Name === name) {
                    if (ix === undefined) {
                        subscriptions[i].fireCallbacks(message, cb);
                    } else {
                        subscriptions[i].fireCallback(message, cb, ix);
                    }
                }
            }
        };
        var subscription = function (name) {
            this.Name = name;
            this.Callbacks = [];
            this.addCallback = function (fn, opt) {
                this.Callbacks.push(new callback(fn, opt));
            };
            this.fireCallback = function (message, cb, ix) {
                this.Callbacks[ix - 1].fn(message);
                if (typeof (this.Callbacks[ix - 1].state) === "object") {
                    if (typeof (this.Callbacks[ix - 1].state.options) !== "undefined" && typeof (this.Callbacks[ix - 1].state.options.counter) !== "undefined") {
                        this.Callbacks[ix - 1].state.options.counter.messages--;
                        if (this.Callbacks[ix - 1].state.options.counter.messages === 0) {
                            if (typeof (this.Callbacks[ix - 1].state.options.counter.completed) === 'function') {
                                this.Callbacks[ix - 1].state.options.counter.completed();
                            }
                        }
                    }
                }
                if (cb && typeof (cb) === "function") {
                    cb();
                }
            };
            this.fireCallbacks = function (message, cb) {
                for (var c = 0; c < this.Callbacks.length; c++) {
                    this.fireCallback(message, cb, c + 1);
                }
            };
        };
        var callback = function (func, opt) {
            this.fn = func;
            this.state = opt;
        };
        return this;
    });


    this.bind = function (event, fn, opts, callback) {
        subscriptions.add(event, fn);
        if (callback && typeof (callback) === "function") {
            callback();
        }
        return this;
    };
    this.unbind = function (event, callback) {
        subscriptions.remove(event);
        if (callback && typeof (callback) === "function") {
            callback();
        }
        return this;
    };
    this.dispatch = function (eventName, message, obj) {
        if (subscriptions.get(eventName) === null) {
            return;
        }
        if (typeof message === "string") {
            message = JSON.parse(message);
        }
        subscriptions.fire(eventName, message, function () { });
    };
    this.channelPublish = function (event, json) {
        for (var c in self.DataChannels) {
            var channel = self.DataChannels[c];
            if (channel.readyState === "open") {
                var message = new XSockets.Message(event, json);
                channel.send(JSON.stringify(message));
            }
        }
        return this;
    };
    this.closeChannel = function (id) {
        self.DataChannels[id].close();
        return this;
    };
    this.channelSubscribe = function (event, peer, callback) {
        self.bind(peer + event, callback);
        return this;
    };
    this.channelUnsubscribe = function (event, peer, callback) {
        self.unbind(peer + event, callback);
        return this;
    };

    var isAudioMuted = false;
    this.muteAudio = function (cb) {
        /// <summary>Toggle mute on all local streams</summary>
        /// <param name="cb" type="Object">function to be invoked when toggled</param>
        localStreams.forEach(function (a, b) {
            var audioTracks = a.getAudioTracks();

            if (audioTracks.length === 0) {
                return;
            }
            if (isAudioMuted) {
                for (i = 0; i < audioTracks.length; i++) {
                    audioTracks[i].enabled = true;
                }
            } else {
                for (i = 0; i < audioTracks.length; i++) {
                    audioTracks[i].enabled = false;
                }
            }
        });
        isAudioMuted = !isAudioMuted;
        if (cb) cb(isAudioMuted);
    };

    this.hasStream = function () {
        /// <summary>Determin of there is media streams attach to the local peer</summary>
        return localStreams.length > 0;
    };


    this.leaveContext = function () {
        /// <summary>Leave the current context (hang up on all )</summary>
        ws.publish("leaveContext", {

        });
        return this;
    };
    this.changeContext = function (contextGuid) {
        /// <summary>Change context on broker</summary>
        /// <param name="contextGuid" type="Object">Unique identifer of the context to 'join'</param>
        ws.publish("changecontext", {
            context: contextGuid
        });
        return this;
    };


    this.getLocalStreams = function () {
        /// <summary>Get local streams</summary>
        return localStreams;
    };

    this.removeStream = function (id, fn) {
        /// <summary>Remove the specified local stream</summary>
        /// <param name="id" type="Object">Id of the media stream</param>
        /// <param name="fn" type="Object">callback function invoked when remote peers notified and stream removed.</param>
        localStreams.forEach(function (stream, index) {
            if (stream.id === id) {
                localStreams[index].stop();
                for (var peer in self.PeerConnections) {
                    self.PeerConnections[peer].Connection.removeStream(localStreams[index]);
                    localStreams.splice(index, 1);
                    createOffer({
                        PeerId: peer
                    });
                    ws.publish("removestream", {
                        recipient: peer,
                        streamId: id
                    });
                    if (fn) fn(id);
                }
            }
        });
    };

    this.userMediaConstraints = {
        qvga: function (audio) {
            return {
                video: {
                    mandatory: {
                        maxWidth: 320,
                        maxHeight: 180
                    }
                },
                audio: typeof (audio) !== "boolean" ? false : audio
            };
        },
        vga: function (audio) {
            return {
                video: {
                    mandatory: {
                        maxWidth: 640,
                        maxHeight: 360
                    }
                },
                audio: typeof (audio) !== "boolean" ? false : audio
            };
        },
        hd: function (audio) {

            return {
                video: {
                    mandatory: {
                        minWidth: 1280,
                        minHeight: 720
                    }
                },
                audio: typeof (audio) !== "boolean" ? false : audio
            };
        },
        create: function (w, h, audio) {
            return {
                video: {
                    mandatory: {
                        minWidth: w,
                        minHeight: h
                    }
                },
                audio: typeof (audio) !== "boolean" ? false : audio
            };
        },
        screenSharing: function () {
            return {
                video: {
                    mandatory: {
                        chromeMediaSource: 'screen'
                    }
                }
            };
        }
    };

    this.getRemotePeers = function () {
        /// <summary>Returns a list of remotePeers (list of id's)</summary>
        var ids = [];
        for (var peer in self.PeerConnections)
            ids.push(peer);
        return ids;

    };

    this.refreshStreams = function (id, fn) {
        /// <summary>Reattach streams and renegotiate</summary>
        /// <param name="id" type="Object">PeerConnection id</param>
        /// <param name="fn" type="Object">callback that will be invoked when completed.</param>
        localStreams.forEach(function (stream, index) {
            self.PeerConnections[id].Connection.removeStream(localStreams[index]);
        });
        createOffer({
            PeerId: id
        });
        if (fn) fn(id);
    };

    this.addLocalStream = function (stream, cb) {
        var index = localStreams.push(stream);
        // Check it there is PeerConnections 
        ws.trigger("AddStream", {
            streamId: stream.id,
            description: ""
        });
        self.dispatch(XSockets.WebRTC.Events.onlocalStream, stream);
        if (cb) cb(stream, index);
        return this;
    };

    this.removePeerConnection = function (id, fn) {
        /// <summary>Remove the specified Peerconnection</summary>
        /// <param name="id" type="guid">Id of the PeerConnection. Id is the PeerId of the actual PeerConnection</param>
        /// <param name="fn" type="function">callback function invoked when the PeerConnection is removed</param>
        ws.publish("peerconnectiondisconnect", {
            Recipient: id,
            Sender: self.CurrentContext.PeerId
        });
        if (self.PeerConnections[id] !== undefined) {
            self.PeerConnections[id].Connection.close();
            self.dispatch(XSockets.WebRTC.Events.onPeerConnectionLost, {
                PeerId: id
            });
        };
        delete self.PeerConnections[id];
        if (fn) fn();
    };

    this.getUserMedia = function (userMediaSettings, success, error) {
        /// <summary>get a media stream</summary>
        /// <param name="userMediaSettings" type="Object">connstraints. i.e .userMediaConstraints.hd()</param>
        /// <param name="success" type="Object">callback function invoked when media stream captured</param>
        /// <param name="error" type="Object">callback function invoked on faild to get the media stream </param>
        window.getUserMedia(userMediaSettings, function (stream) {
            localStreams.push(stream);
            ws.trigger("AddStream", {
                streamId: stream.id,
                description: ""
            });
            self.dispatch(XSockets.WebRTC.Events.onlocalStream, stream);
            if (success && typeof (success) === "function") success(self.CurrentContext);
        }, function (err) {
            if (error && typeof (error) === "function") error(err);
        });
        return this;
    };

    // private

    var subscriptions = new Subscriptions();
    var rtcPeerConnection = function (configuration, peerId) {
        var that = this;
        this.PeerId = peerId;
        this.Connection = new RTCPeerConnection(
            configuration.RTCConfiguration,
            configuration.MediaConstraints);
        this.Connection.onconnection = function () { };
        try {
            self.DataChannels[peerId] = this.Connection.createDataChannel('RTCDataChannel', {
                reliable: false
            });
            self.DataChannels[peerId].onmessage = function (event) {
                var message = JSON.parse(event.data).JSON;
                self.dispatch(that.PeerId + message.event, message.data, that.PeerId);
            };
            self.DataChannels[peerId].onopen = function () {
                self.dispatch(XSockets.WebRTC.Events.onDataChannelOpen, {
                    PeerId: self.DataChannels[peerId]
                });
            };
            self.DataChannels[peerId].onclose = function () {
                self.dispatch(XSockets.WebRTC.Events.onDataChannelClose, {
                    PeerId: self.DataChannels[peerId]
                });
            };
        } catch (ex) {
            console.log("'Create Data channel failed with exception:", ex.message);
        }
        this.Connection.onaddstream = function (event) {
            self.dispatch(XSockets.WebRTC.Events.onRemoteStream, {
                PeerId: that.PeerId,
                stream: event.stream
            });

        };
        this.Connection.onicecandidate = function (event) {
            if (event.candidate) {
                var candidate = {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                };
                ws.publish("contextsignal", {
                    sender: self.CurrentContext.PeerId,
                    recipient: that.PeerId,
                    message: JSON.stringify(candidate)
                });
            }
        };
        self.dispatch(XSockets.WebRTC.Events.onPeerConnectionCreated, new peerConnection(that.PeerId));
    };
    var peerConnection = function (id) {
        this.PeerId = id;
        this.publish = function (topic, obj, cb) {
            for (var c in self.DataChannels) {
                var channel = self.DataChannels[c];
                if (channel.readyState === "open") {
                    var message = new XSockets.Message(event, json);
                    channel.send(JSON.stringify(message));
                }
            }
            if (typeof (cb) === "function") cb();
        }
        this.subscribe = function (topic, cb) {
            self.bind(this.Id + topic, cb);
        },
        this.unsubscribe = function (topic, cb) {
            self.unbind(this.Id + topic, cb);
        };
    };
    var createOffer = function (peer) {

        self.PeerConnections[peer.PeerId] = new rtcPeerConnection(options, peer.PeerId);
        localStreams.forEach(function (a, b) {
            self.PeerConnections[peer.PeerId].Connection.addStream(a);
        });


        self.PeerConnections[peer.PeerId].Connection.createOffer(function (localDescription) {
            options.sdpExpressions.forEach(function (expr, b) {
                localDescription.sdp = expr(localDescription.sdp);
            });
            self.PeerConnections[peer.PeerId].Connection.setLocalDescription(localDescription);
            ws.publish("contextsignal", {
                Sender: self.CurrentContext.PeerId,
                Recipient: peer.PeerId,
                Message: JSON.stringify(localDescription)
            });
        }, null, options.MediaConstraints);
    };

    self.bind("connect", function (peer) {

        createOffer(peer);
    });
    self.bind("candidate", function (event) {
        var candidate = JSON.parse(event.Message);
        self.PeerConnections[event.Sender].Connection.addIceCandidate(new RTCIceCandidate({
            sdpMLineIndex: candidate.label,
            candidate: candidate.candidate
        }));
    });
    self.bind("answer", function (event) {
        self.dispatch(XSockets.WebRTC.Events.onAnswer, {
            PeerId: event.Sender
        });
        self.PeerConnections[event.Sender].Connection.setRemoteDescription(new RTCSessionDescription(JSON.parse(event.Message)));
    });
    self.bind("offer", function (event) {

        self.dispatch(XSockets.WebRTC.Events.onOffer, {
            PeerId: event.Sender
        });

        self.PeerConnections[event.Sender] = new rtcPeerConnection(options, event.Sender);
        self.PeerConnections[event.Sender].Connection.setRemoteDescription(new RTCSessionDescription(JSON.parse(event.Message)));
        localStreams.forEach(function (a, b) {
            self.PeerConnections[event.Sender].Connection.addStream(a);
        });
        self.PeerConnections[event.Sender].Connection.createAnswer(function (description) {
            self.PeerConnections[event.Sender].Connection.setLocalDescription(description);
            options.sdpExpressions.forEach(function (expr, b) {
                description.sdp = expr(description.sdp);
            });

            var answer = {
                Sender: self.CurrentContext.PeerId,
                Recipient: event.Sender,
                Message: JSON.stringify(description)
            };


            ws.publish("contextsignal", answer);
        }, null, options.MediaConstraints);

    });
    ws.subscribe("contextcreated", function (context) {
        self.CurrentContext = new XSockets.PeerContext(context.PeerId, context.Context);
        self.dispatch(XSockets.WebRTC.Events.onContextCreated, context);
        
    },function() {
        ws.publish('GetContext');
    });
    ws.subscribe("contextsignal", function (signal) {
        var msg = JSON.parse(signal.Message);
        self.dispatch(msg.type, signal);
    });
    ws.subscribe("contextchanged", function (change) {
        self.dispatch(XSockets.WebRTC.Events.onContextChange, change);
    });
    ws.subscribe("contextconnect", function (peers) {

        peers.forEach(function (peer) {
            self.dispatch("connect", peer);
            self.dispatch(XSockets.WebRTC.Events.onPeerConnectionStarted, peer);
        });
    });
    ws.subscribe("peerconnectiondisconnect", function (peer) {
        if (self.PeerConnections[peer.Sender] !== undefined) {
            self.PeerConnections[peer.Sender].Connection.close();
            self.dispatch(XSockets.WebRTC.Events.onPeerConnectionLost, {
                PeerId: peer.Sender
            });
            delete self.PeerConnections[peer.Sender];
        }
    });
    ws.subscribe("streamadded", function (event) {
        self.dispatch(XSockets.WebRTC.Events.onLocalStreamCreated, event);
    });
    ws.subscribe("streamremoved", function (event) {
        self.dispatch(XSockets.WebRTC.Events.onRemoteStreamLost, {
            PeerId: event.Sender,
            StreamId: event.StreamId
        });
    });
    ws.subscribe("peerconnectionlost", function (peer) {
        if (self.PeerConnections[peer.PeerId] !== undefined) {
            self.PeerConnections[peer.PeerId].Connection.close();
            self.dispatch(XSockets.WebRTC.Events.onPeerConnectionLost, {
                PeerId: peer.PeerId
            });
            delete self.PeerConnections[peer.PeerId];
        };
    });
};

// Call manager  
XSockets.WebRTC.CallManager = function (ws, settings) {
    var events = settings.events;
    this.call = function (recipient) {
        ws.trigger("offercontext", {
            PeerId: recipient.PeerId
        });
    };

    this.acceptCall = function (call) {
        events.onAcceptCall(call);
    };
    this.denyCall = function (recipient) {
        ws.trigger("denycontext", {
            PeerId: recipient.PeerId
        });
    };
    this.endCall = function () {
        ws.trigger("leavecontext", {});
    };
    ws.subscribe("contextoffer", events.onCall);
    ws.subscribe("contextdeny", events.onDenyCall);
};



XSockets.WebRTC.Events = {
    onlocalStream: "localstream",
    onRemoteStream: "remotestream",
    onRemoteStreamLost: "removestream",
    onLocalStreamCreated: "streamadded",

    onContextChange: "contexchanged", // Fires when the current context changes
    onContextCreated: "contextcreated", // Fires when a client recives a new context

    onPeerConnectionStarted: "peerconnectionstarted", // Fires when a new RTCPeerConnection is initialized
    onPeerConnectionCreated: "peerconnectioncreated", // Fires when a new RTCPeerConnection is created
    onPeerConnectionLost: "peerconnectionlost", // Fires when a RTCPeerConnection is lost

    onDataChannelOpen: "datachannelopen", // Fires when a datachannel is open
    onDataChannelClose: "datachannelclose", // Fires when a datachannes is closed



    onOffer: 'sdpoffer',
    onAnswer: 'sdanswer'

};