using System;

namespace YourNamespace.Models
{
    public interface IPeerConnection
    {
        Guid Context { get; set; }
        Guid PeerId { get; set; }
    }
}