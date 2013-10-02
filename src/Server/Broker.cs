using System;
using System.Collections.Generic;
using XSockets.Core.Common.Socket.Event.Arguments;
using XSockets.Core.Common.Socket.Event.Attributes;
using XSockets.Core.Common.Socket.Event.Interface;
using XSockets.Core.XSocket;
using XSockets.Core.XSocket.Helpers;
using YourNamespace.Constants;
using YourNamespace.Extentions;
using YourNamespace.Models;

namespace YourNamespace
{
    /// <summary>
    /// A custom Peerbroker for WebRTC signaling and WebSocket communication on top of XSockets.NET
    /// </summary>
    public sealed class Broker : XBaseSocket, IBroker
    {
        #region Public Properties

        /// <summary>
        /// List of PeerConnections that the Peer has connected to
        /// </summary>
        [NoEvent]
        public List<IPeerConnection> Connections { get; set; }

        /// <summary>
        /// The Peer for this client
        /// </summary>
        [NoEvent]
        public IPeerConnection Peer { get; set; }

        #endregion

        #region Ctor

        /// <summary>
        /// Ctor - setting up connectionlist and open/close events
        /// </summary>
        public Broker()
        {
            Connections = new List<IPeerConnection>(); 

            this.OnClose += _OnClose;            

            this.OnOpen += _OnOpen;            
        }

        #endregion

        #region Private Methods & Events
        /// <summary>
        /// When a client connects create a new PeerConnection and send the information the the client
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="onClientConnectArgs"></param>
        private void _OnOpen(object sender, OnClientConnectArgs onClientConnectArgs)
        {
            Peer = new PeerConnection
            {
                Context = Guid.NewGuid(),
                PeerId = ClientGuid
            };
            this.Send(Peer, Events.Context.Created);
        }

        /// <summary>
        /// When a client disconnects tell the other clients about the Peer being lost
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="onClientDisConnectArgs"></param>
        private void _OnClose(object sender, OnClientDisConnectArgs onClientDisConnectArgs)
        {
            this.NotifyPeerLost();
        }

        private void NotifyPeerLost()
        {
            if (Peer == null) return;
            this.SendTo(f => f.Peer.Context.Equals(Peer.Context), Peer, Events.Peer.Lost);
        }
        
        #endregion

        #region Overrides from XSocketController

        /// <summary>
        /// Give this controller a "Generic" behavior
        /// Any object sent (that do not have an action method) in will be sent out to the clients subscribing to the topic.
        /// </summary>
        /// <param name="textArgs"></param>
        public override void OnMessage(ITextArgs textArgs)
        {
            this.SendToAll(textArgs);
        } 

        #endregion

        #region Signaling Methods

        /// <summary>
        /// Distribute signals (SDP's)
        /// </summary>
        /// <param name="signalingModel"></param>
        public void ContextSignal(SignalingModel signalingModel)
        {
            this.SendTo(f => f.ClientGuid.Equals(signalingModel.Recipient), signalingModel, Events.Context.Signal);
        }
               
        /// <summary>
        /// Leave a context
        /// </summary>
        public void LeaveContext()
        {
            this.NotifyPeerLost();
            
            this.Peer.Context = new Guid();
            this.Send(Peer, Events.Context.Created);
        }
        /// <summary>
        ///     Send and contect offer to a Peer
        /// </summary>
        /// <param name="recipient">Recipient</param>
        public void OfferContext(Guid recipient)
        {
            this.SendTo(p => p.ClientGuid.Equals(recipient),
                        Peer, Events.Context.Offer);
        }
        /// <summary>
        ///     Deny a context offer
        /// </summary>
        /// <param name="recipient">Recipient</param>
        public void DenyContext(Guid recipient)
        {
            this.SendTo(p => p.ClientGuid.Equals(recipient),
                        Peer, Events.Context.Deny);
        }

        /// <summary>
        ///    Current client changes context
        /// </summary>
        /// <param name="context"></param>
        public void ChangeContext(Guid context)
        {
            this.Peer.Context = context;
            this.NotifyContextChange(context, this.ConnectToContext);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="recipient"></param>
        public void DisconnectPeer(Guid recipient)
        {
            this.SendTo(p => p.ClientGuid.Equals(recipient),
                        new
                            {
                                Sender = this.ClientGuid
                            }, Events.Peer.Disconnect);
        }

        #endregion

        #region Stream Methods

        /// <summary>
        /// Notify PeerConnections on the current context that a MediaStream is removed.
        /// </summary>
        /// <param name="streamId"></param>
        public void RemoveStream(string streamId)
        {
            this.SendTo(f => f.Peer.Context.Equals(Peer.Context), new StreamModel {Sender = ClientGuid, StreamId = streamId},
                        Events.Stream.Remove
                );
        }

        /// <summary>
        /// Notify PeerConnections on the current context that a MediaStream is added.
        /// </summary>
        /// <param name="streamId"></param>
        /// <param name="description">JSON</param>
        public void AddStream(string streamId, string description)
        {
            this.SendTo(f => f.Peer.Context.Equals(Peer.Context), new StreamModel
                {
                    Sender = ClientGuid,
                    StreamId = streamId,
                    Description = description
                }, Events.Stream.Add);
        }

        #endregion
    }
}