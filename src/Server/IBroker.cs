using System;
using System.Collections.Generic;
using XSockets.Core.Common.Socket.Event.Interface;
using YourNamespace.Models;

namespace YourNamespace
{
    public interface IBroker
    {
        /// <summary>
        /// List of PeerConnections that the Current PeerConnections has connected to
        /// </summary>
        List<IPeerConnection> Connections { get; set; }

        /// <summary>
        /// The Peer of this connection
        /// </summary>
        IPeerConnection Peer { get; set; }

        /// <summary>
        /// Distribute signals (SDP's)
        /// </summary>
        /// <param name="signalingModel"></param>
        void ContextSignal(SignalingModel signalingModel);

        /// <summary>
        /// Give this controller a "Generic" behavior
        /// </summary>
        /// <param name="textArgs"></param>
        void OnMessage(ITextArgs textArgs);

        /// <summary>
        /// Leave a context
        /// </summary>
        void LeaveContext();

        /// <summary>
        /// Send and contect offer to a Peer
        /// </summary>
        /// <param name="recipient">Recipient</param>
        void OfferContext(Guid recipient);

        /// <summary>
        /// Deny a context offer
        /// </summary>
        /// <param name="recipient">Recipient</param>
        void DenyContext(Guid recipient);

        /// <summary>
        /// Current client changes context
        /// </summary>
        /// <param name="contextId"></param>
        void ChangeContext(Guid contextId);

        /// <summary>
        /// Remove another peer by id
        /// </summary>
        /// <param name="recipient"></param>
        void DisconnectPeer(Guid recipient);

        /// <summary>
        /// Notify PeerConnections on the current context that a MediaStream is removed.
        /// </summary>
        /// <param name="streamId"></param>
        void RemoveStream(string streamId);

        /// <summary>
        /// Notify PeerConnections on the current context that a MediaStream is added.
        /// </summary>
        /// <param name="streamId"></param>
        /// <param name="description">JSON</param>
        void AddStream(string streamId, string description);
    }
}