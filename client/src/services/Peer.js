const defaultIce = () => {
  const base = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:global.stun.twilio.com:3478",
      ],
    },
  ];
  const raw =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_EXTRA_ICE_SERVERS) ||
    (typeof process !== "undefined" && process.env?.REACT_APP_EXTRA_ICE_SERVERS);
  if (raw) {
    try {
      const extra = JSON.parse(raw);
      if (Array.isArray(extra) && extra.length) return [...base, ...extra];
    } catch {
      /* ignore invalid env */
    }
  }
  return base;
};

const ICE_SERVERS = defaultIce();

export class PeerService {
  constructor() {
    this._create();
  }

  _create() {
    this.peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this._addedTrackIds = new Set();
    this._pendingRemoteCandidates = [];
    this._remoteDescriptionSet = false;
  }

  onIceCandidate(handler) {
    this.peer.onicecandidate = (event) => {
      if (event.candidate) handler(event.candidate.toJSON());
    };
  }

  onTrack(handler) {
    this.peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) handler(stream);
    };
  }

  addLocalStream(stream) {
    if (!stream) return;
    for (const track of stream.getTracks()) {
      if (this._addedTrackIds.has(track.id)) continue;
      this.peer.addTrack(track, stream);
      this._addedTrackIds.add(track.id);
    }
  }

  async createOffer() {
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    return this.peer.localDescription;
  }

  async acceptOffer(offer) {
    await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
    this._remoteDescriptionSet = true;
    await this._flushPendingCandidates();
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    return this.peer.localDescription;
  }

  async acceptAnswer(answer) {
    await this.peer.setRemoteDescription(new RTCSessionDescription(answer));
    this._remoteDescriptionSet = true;
    await this._flushPendingCandidates();
  }

  async addRemoteIceCandidate(candidate) {
    if (!candidate) return;
    if (!this._remoteDescriptionSet) {
      this._pendingRemoteCandidates.push(candidate);
      return;
    }
    try {
      await this.peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("addIceCandidate failed", err);
    }
  }

  async _flushPendingCandidates() {
    const queue = this._pendingRemoteCandidates;
    this._pendingRemoteCandidates = [];
    for (const c of queue) {
      try {
        await this.peer.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.warn("flushed addIceCandidate failed", err);
      }
    }
  }

  reset() {
    try {
      this.peer.onicecandidate = null;
      this.peer.ontrack = null;
      this.peer.close();
    } catch (_) {
      /* noop */
    }
    this._create();
  }
}

export function createPeerService() {
  return new PeerService();
}
