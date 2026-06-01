"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

const HLS_CONFIG = {
  liveSyncDurationCount: 2,
  liveMaxLatencyDurationCount: 4,
  liveDurationInfinity: true,
  enableWorker: true,
  lowLatencyMode: true,
};

export default function VideoPlayer({ hlsUrl }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const retryDelayRef = useRef(1000);
  const retryTimeoutRef = useRef(null);

  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;
    const video = videoRef.current;

    // Bug fix: reset state on every hlsUrl change
    setError(null);
    setLoading(true);
    retryDelayRef.current = 1000;

    // Safari — native HLS support
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.play().catch(() => {});
      setLoading(false);
      return () => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    if (!Hls.isSupported()) {
      setError("Browser ของคุณไม่รองรับ HLS");
      setLoading(false);
      return;
    }

    const hls = new Hls(HLS_CONFIG);
    hlsRef.current = hls;

    hls.loadSource(hlsUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
      setLoading(false);
      // Reset retry delay on successful play
      retryDelayRef.current = 1000;
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      setError("ไม่สามารถโหลด stream ได้ กรุณารอสักครู่...");
      setLoading(false);

      // Exponential backoff retry
      const delay = retryDelayRef.current;
      retryTimeoutRef.current = setTimeout(() => {
        hls.loadSource(hlsUrl);
        retryDelayRef.current = Math.min(delay * 2, 30000);
      }, delay);
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      console.log(
        `[HLS] Quality switched to level ${data.level}, height: ${data.height}`,
      );
    });

    // Visibility change handler - pause when hidden, play when visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Bug fix: destroy on every effect cleanup, not just unmount
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      hls.destroy();
      hlsRef.current = null;
    };
  }, [hlsUrl]);

  return (
    <div
      style={{
        position: "relative",
        background: "#000",
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}
    >
      {loading && <LoadingOverlay />}
      {error && !loading && <ErrorOverlay message={error} />}

      <video
        ref={videoRef}
        muted={muted}
        autoPlay
        playsInline
        controls
        style={{ width: "100%", aspectRatio: "16/9", display: "block" }}
      />

      {muted && !loading && !error && (
        <button
          onClick={() => setMuted(false)}
          style={{
            position: "absolute",
            bottom: "60px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            border: "1px solid #555",
            padding: "8px 20px",
            borderRadius: "var(--radius-full)",
            cursor: "pointer",
            fontSize: "13px",
            zIndex: 3,
          }}
        >
          คลิกเพื่อเปิดเสียง
        </button>
      )}
    </div>
  );
}

// ─── Local sub-components ────────────────────────────────────────────────────

function Overlay({ children, style }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        background: "rgba(0,0,0,0.7)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function LoadingOverlay() {
  return (
    <Overlay>
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid #444",
          borderTop: "3px solid var(--accent)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
        กำลังโหลด stream...
      </span>
    </Overlay>
  );
}

function ErrorOverlay({ message }) {
  return (
    <Overlay style={{ background: "rgba(0,0,0,0.85)" }}>
      <span style={{ fontSize: "32px" }}>📡</span>
      <span
        style={{
          color: "var(--text-muted)",
          fontSize: "14px",
          textAlign: "center",
          padding: "0 20px",
        }}
      >
        {message}
      </span>
    </Overlay>
  );
}
