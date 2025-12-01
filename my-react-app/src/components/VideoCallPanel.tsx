// src/components/VideoCallPanel.tsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
  IconButton,
  Stack,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import PhoneIcon from "@mui/icons-material/Phone";
import type { Socket } from "socket.io-client";

interface VideoCallPanelProps {
  socket: Socket;
  sessionId: string;
}

export default function VideoCallPanel({
  socket,
  sessionId,
}: VideoCallPanelProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(
    null
  );
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(
    null
  );
  const [isVideoEnabled, setIsVideoEnabled] =
    useState(true);
  const [isAudioEnabled, setIsAudioEnabled] =
    useState(true);
  const [isCallActive, setIsCallActive] =
    useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(
    null
  );
  const mainVideoRef = useRef<HTMLVideoElement | null>(
    null
  );
  const pipVideoRef = useRef<HTMLVideoElement | null>(
    null
  );

  const rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  /* ------------------------ PeerConnection helper ------------------------ */

  const getPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(rtcConfiguration);
    console.log("🔌 Created RTCPeerConnection");

    pc.ontrack = (event) => {
      console.log("🎥 ontrack fired, kind:", event.track.kind);

      setRemoteStream((prev) => {
        let stream = prev ?? new MediaStream();

        if (event.streams && event.streams.length > 0) {
          const [firstStream] = event.streams;
          firstStream
            .getTracks()
            .forEach((track) => {
              if (
                !stream
                  .getTracks()
                  .some((t) => t.id === track.id)
              ) {
                stream.addTrack(track);
                console.log(
                  "✅ Added remote track from streams:",
                  track.kind,
                  track.id
                );
              }
            });
        } else {
          // fallback: only event.track
          const track = event.track;
          if (
            !stream
              .getTracks()
              .some((t) => t.id === track.id)
          ) {
            stream.addTrack(track);
            console.log(
              "✅ Added remote track from single track:",
              track.kind,
              track.id
            );
          }
        }

        return stream;
      });

      setIsCallActive(true);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("🧊 ICE candidate generated");
        socket.emit("ice-candidate", {
          sessionId,
          candidate: event.candidate,
        });
      } else {
        console.log("🧊 ICE gathering complete");
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(
        "🔌 Peer connection state:",
        pc.connectionState
      );
    };

    pcRef.current = pc;
    return pc;
  }, [socket, sessionId]);

  /* ------------------------ Local stream helper ------------------------- */

  const startLocalStream = useCallback(async () => {
    const pc = getPeerConnection();
    if (!pc) return null;

    if (!localStreamRef.current) {
      console.log("📹 Getting local stream...");
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log(
          "✅ Added local track to PC:",
          track.kind,
          track.id
        );
      });
    } else {
      console.log(
        "📹 Reusing existing local stream"
      );
    }

    return pc;
  }, [getPeerConnection]);

  const stopAllMedia = useCallback(() => {
    console.log(
      "🧹 Stopping media + closing peer connection"
    );

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);

    setRemoteStream((prev) => {
      if (prev) {
        prev.getTracks().forEach((t) => t.stop());
      }
      return null;
    });

    setIsCallActive(false);

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
  }, []);

  /* ---------------------- Socket signalling handlers -------------------- */

  useEffect(() => {
    const handleVideoOffer = async ({
      sdp,
      sessionId: incomingSessionId,
    }: {
      sdp: RTCSessionDescriptionInit;
      sessionId: string;
    }) => {
      if (incomingSessionId !== sessionId) return;

      console.log(
        "📥 Received video-offer (I am ANSWERER)"
      );

      const pc = getPeerConnection();
      if (!pc) return;

      await startLocalStream();

      await pc.setRemoteDescription(
        new RTCSessionDescription(sdp)
      );
      console.log(
        "✅ Remote description set (offer)"
      );

      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(answer);
      console.log(
        "✅ Answer created + local description set"
      );

      socket.emit("video-answer", {
        sessionId,
        answer: pc.localDescription, // ✅ backend expects .answer
      });
      console.log("📤 Answer sent");
    };

    const handleVideoAnswer = async ({
      sdp,
      sessionId: incomingSessionId,
    }: {
      sdp: RTCSessionDescriptionInit;
      sessionId: string;
    }) => {
      if (incomingSessionId !== sessionId) return;

      console.log(
        "📥 Received video-answer (I am CALLER)"
      );

      const pc = pcRef.current;
      if (!pc) {
        console.warn(
          "⚠️ No PC on video-answer"
        );
        return;
      }

      await pc.setRemoteDescription(
        new RTCSessionDescription(sdp)
      );
      console.log(
        "✅ Remote description set (answer)"
      );
    };

    const handleIceCandidate = async ({
      candidate,
      sessionId: incomingSessionId,
    }: {
      candidate: RTCIceCandidateInit;
      sessionId: string;
    }) => {
      if (incomingSessionId !== sessionId) return;

      const pc = getPeerConnection();
      if (!pc) return;

      try {
        if (candidate) {
          await pc.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
          console.log(
            "✅ ICE candidate added"
          );
        }
      } catch (err) {
        console.error(
          "❌ Error adding ICE candidate:",
          err
        );
      }
    };

    const handleEndCallSignal = () => {
      console.log("📴 Received end-call");
      stopAllMedia();
    };

    socket.on("video-offer", handleVideoOffer);
    socket.on("video-answer", handleVideoAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("end-call", handleEndCallSignal);

    return () => {
      socket.off("video-offer", handleVideoOffer);
      socket.off("video-answer", handleVideoAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("end-call", handleEndCallSignal);
    };
  }, [
    socket,
    sessionId,
    getPeerConnection,
    startLocalStream,
    stopAllMedia,
  ]);

  /* -------------------------- Start / End Call -------------------------- */

  const handleStartCall = useCallback(async () => {
    console.log(
      "☎️ Start Call clicked – acting as CALLER"
    );

    const pc = await startLocalStream();
    if (!pc) return;

    setIsCallActive(true);

    // Agar already negotiating ho raha hai, dobara offer na banao
    if (
      pc.localDescription ||
      pc.remoteDescription
    ) {
      console.log(
        "⚠️ PC already has description, skipping new offer"
      );
      return;
    }

    console.log("📞 Creating offer");
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);
    console.log(
      "✅ Offer created + local description set"
    );

    socket.emit("video-offer", {
      sessionId,
      offer: pc.localDescription, // ✅ backend expects .offer
    });
    console.log("📤 Offer sent");
  }, [startLocalStream, sessionId, socket]);

  const handleEndCall = useCallback(() => {
    console.log("☎️ End Call clicked");
    socket.emit("end-call", { sessionId });
    stopAllMedia();
  }, [sessionId, socket, stopAllMedia]);

  /* ------------------------- Audio / Video toggle ----------------------- */

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;

    const videoTracks =
      localStreamRef.current.getVideoTracks();
    if (!videoTracks.length) return;

    const newEnabled = !videoTracks[0].enabled;
    videoTracks.forEach(
      (t) => (t.enabled = newEnabled)
    );
    setIsVideoEnabled(newEnabled);
    console.log(
      "📷 Camera:",
      newEnabled ? "ON" : "OFF"
    );
  }, []);

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;

    const audioTracks =
      localStreamRef.current.getAudioTracks();
    if (!audioTracks.length) return;

    const newEnabled = !audioTracks[0].enabled;
    audioTracks.forEach(
      (t) => (t.enabled = newEnabled)
    );
    setIsAudioEnabled(newEnabled);
    console.log(
      "🎙 Mic:",
      newEnabled ? "ON" : "OFF"
    );
  }, []);

  /* ----------------------- Bind <video> elements ------------------------ */

  useEffect(() => {
    const main = mainVideoRef.current;
    if (!main) return;

    if (
      remoteStream &&
      remoteStream.getTracks().length > 0
    ) {
      console.log(
        "🎬 Binding REMOTE stream to main video"
      );
      main.srcObject = remoteStream;
    } else {
      main.srcObject = null;
    }
  }, [remoteStream]);

  useEffect(() => {
    const pip = pipVideoRef.current;
    if (!pip) return;

    if (
      localStream &&
      localStream.getTracks().length > 0
    ) {
      console.log(
        "👤 Binding LOCAL stream to PiP"
      );
      pip.srcObject = localStream;
    } else {
      pip.srcObject = null;
    }
  }, [localStream]);

  /* --------------------------- Cleanup on unmount ----------------------- */

  useEffect(() => {
    return () => {
      stopAllMedia();
    };
  }, [stopAllMedia]);

  /* ----------------------------- JSX ----------------------------------- */

  return (
    <Paper
      elevation={5}
      sx={{
        p: 2,
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Box display="flex" alignItems="center" gap={1}>
        <VideocamIcon color="primary" />
        <Typography variant="h6" fontWeight="bold">
          Video Call
        </Typography>
      </Box>

      {/* Main video container */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: { xs: 300, sm: 400, md: 500 },
          backgroundColor: "#000",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {/* Remote video */}
        <video
          ref={mainVideoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Local PiP */}
        {localStream && (
          <Box
            sx={{
              position: "absolute",
              bottom: 12,
              right: 12,
              width: { xs: 120, sm: 160 },
              height: { xs: 90, sm: 120 },
              backgroundColor: "#000",
              borderRadius: 2,
              overflow: "hidden",
              border:
                "2px solid rgba(255, 255, 255, 0.8)",
              boxShadow:
                "0 4px 12px rgba(0, 0, 0, 0.5)",
              opacity: isVideoEnabled ? 1 : 0.5,
            }}
          >
            <video
              ref={pipVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            {!isVideoEnabled && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    "rgba(0, 0, 0, 0.7)",
                  color:
                    "rgba(255, 255, 255, 0.8)",
                }}
              >
                <VideocamOffIcon fontSize="small" />
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Stack
        direction="row"
        spacing={2}
        justifyContent="center"
      >
        {!isCallActive && !localStream && (
          <Button
            variant="contained"
            startIcon={<PhoneIcon />}
            onClick={handleStartCall}
            sx={{
              background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
              borderRadius: "12px",
              px: 3,
              py: 1.2,
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 8px 24px rgba(139, 92, 246, 0.4)",
                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              },
            }}
          >
            Start Call
          </Button>
        )}

        {localStream && (
          <>
            <IconButton
              onClick={toggleVideo}
              color={
                isVideoEnabled ? "primary" : "error"
              }
              sx={{
                bgcolor: isVideoEnabled
                  ? "rgba(113, 90, 90, 0.1)"
                  : "rgba(239, 68, 68, 0.1)",
                "&:hover": {
                  bgcolor: isVideoEnabled
                    ? "rgba(113, 90, 90, 0.2)"
                    : "rgba(239, 68, 68, 0.2)",
                },
              }}
            >
              {isVideoEnabled ? (
                <VideocamIcon />
              ) : (
                <VideocamOffIcon />
              )}
            </IconButton>

            <IconButton
              onClick={toggleAudio}
              color={
                isAudioEnabled ? "primary" : "error"
              }
              sx={{
                bgcolor: isAudioEnabled
                  ? "rgba(113, 90, 90, 0.1)"
                  : "rgba(239, 68, 68, 0.1)",
                "&:hover": {
                  bgcolor: isAudioEnabled
                    ? "rgba(113, 90, 90, 0.2)"
                    : "rgba(239, 68, 68, 0.2)",
                },
              }}
            >
              {isAudioEnabled ? (
                <MicIcon />
              ) : (
                <MicOffIcon />
              )}
            </IconButton>

            <IconButton
              onClick={handleEndCall}
              color="error"
              sx={{
                bgcolor: "rgba(239, 68, 68, 0.1)",
                "&:hover": {
                  bgcolor:
                    "rgba(239, 68, 68, 0.2)",
                },
              }}
            >
              <CallEndIcon />
            </IconButton>
          </>
        )}
      </Stack>
    </Paper>
  );
}
