using System;
using System.Collections.Generic;
using System.Linq;
using XSockets.Core.Common.Socket;
using XSockets.Core.XSocket;
using XSockets.Core.XSocket.Helpers;
using YourNamespace.Constants;
using YourNamespace.Models;

namespace YourNamespace.Extentions
{
    /// <summary>
    /// Extension for finding and signaling clients
    /// </summary>
    public static class ContextHelper
    {
        /// <summary>
        /// Send a ContextChanged event to the clients on the context
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="obj"></param>
        /// <param name="context"></param>
        internal static void NotifyContextChange<T>(this T obj, Guid context) where T : XBaseSocket, IBroker, IXBaseSocket
        {
            obj.NotifyContextChange(context, null);
        }

        /// <summary>
        /// Send a ContextChanged event to the clients on the context and then fires the callback action
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="obj"></param>
        /// <param name="contextId"></param>
        /// <param name="callback"></param>
        internal static void NotifyContextChange<T>(this T obj, Guid context, Action callback) where T : XBaseSocket, IBroker, IXBaseSocket
        {
            // Notify a context change                        
            obj.SendTo(c => c.Peer.Context.Equals(context), obj.Find(q => q.Peer.Context.Equals(context)).Select(p => p.Peer), Events.Context.Changed);
            if(callback != null)
                callback();
        }

        /// <summary>
        /// Sends a Contect Connect event to all clients connected to this Peer
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="obj"></param>
        internal static void ConnectToContext<T>(this T obj) where T : XBaseSocket, IBroker, IXBaseSocket
        {            
            // Pass the client a list of Peers to Connect
            obj.Send(obj.Connections(obj.Peer)
                       .Where(q => !q.Connections.Contains(obj.Peer)).
                        Select(p => p.Peer).AsTextArgs(Events.Context.Connect));
        }

        /// <summary>
        /// Find all clients connected to the context except for the "calling" client
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="obj"></param>
        /// <param name="peerConnection"></param>
        /// <returns></returns>
        internal static IEnumerable<T> Connections<T>(this T obj, IPeerConnection peerConnection)
            where T : XBaseSocket, IBroker, IXBaseSocket
        {            
            return obj.Find(f => f.Peer.Context.Equals(peerConnection.Context)).Select(p => p).Except(new List<T>{obj});
        }
    }
}