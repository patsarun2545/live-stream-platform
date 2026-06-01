"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const MAX_MESSAGES = 200;

// Bug fix: use wss:// in production (https pages block ws://)
function buildWsUrl(videoId) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const port = process.env.NEXT_PUBLIC_WS_PORT || 3001;
  const url = `${protocol}://${window.location.hostname}:${port}/chat/${videoId}`;
  return url;
}

export default function ChatBox({ videoId, user }) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [shouldStopRetry, setShouldStopRetry] = useState(false);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const retryRef = useRef(null);
  const retryDelayRef = useRef(1000);
  const mountedRef = useRef(true); // track mount state to prevent post-unmount retries
  const inputRef = useRef(null);

  const connect = useCallback(() => {
    if (shouldStopRetry) return;

    const ws = new WebSocket(buildWsUrl(videoId));

    ws.onopen = () => {
      setConnected(true);
      setRetryCount(0);
      retryDelayRef.current = 1000;
      clearTimeout(retryRef.current);
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), data]);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = (event) => {
      setConnected(false);

      // Stop retry for policy violation or server error
      if (event.code === 1008 || event.code === 1011) {
        setShouldStopRetry(true);
        return;
      }

      if (mountedRef.current && !shouldStopRetry && !navigator.onLine) {
        // Don't retry if offline
        return;
      }

      if (mountedRef.current && !shouldStopRetry) {
        const delay = retryDelayRef.current;
        setRetryCount((prev) => prev + 1);
        retryRef.current = setTimeout(() => {
          retryDelayRef.current = Math.min(delay * 2, 30000);
          connect();
        }, delay);
      }
    };
    ws.onerror = () => ws.close();

    wsRef.current = ws;
  }, [videoId, shouldStopRetry]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    // Online/offline event listeners
    const handleOnline = () => {
      setShouldStopRetry(false);
      retryDelayRef.current = 1000;
      setRetryCount(0);
      connect();
    };

    const handleOffline = () => {
      clearTimeout(retryRef.current);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      mountedRef.current = false;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [connect]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = inputRef.current?.value || "";
    if (!text.trim() || wsRef.current?.readyState !== WebSocket.OPEN || !user)
      return;
    wsRef.current.send(
      JSON.stringify({
        type: "message",
        text: text.trim(),
      }),
    );
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Get connection status message
  const getConnectionStatus = () => {
    if (connected) return "เชื่อมต่อแล้ว";
    if (shouldStopRetry) return "ไม่สามารถเชื่อมต่อได้";
    if (retryCount <= 2) return "กำลังเชื่อมต่อ...";
    if (retryCount <= 5) return `เชื่อมต่อใหม่... (ครั้งที่ ${retryCount})`;
    return "ไม่สามารถเชื่อมต่อได้";
  };

  const handleReload = () => {
    setShouldStopRetry(false);
    retryDelayRef.current = 1000;
    setRetryCount(0);
    connect();
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={{ fontWeight: 600, fontSize: "14px" }}>แชทสด</span>
        <span
          style={{
            ...styles.dot,
            background: connected ? "#00c853" : "var(--text-dim)",
          }}
        />
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginLeft: "auto",
          }}
        >
          {getConnectionStatus()}
        </span>
        {retryCount >= 6 && !connected && !shouldStopRetry && (
          <button
            onClick={handleReload}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            ลองใหม่
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={styles.messageList}>
        {messages.length === 0 && (
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "13px",
              textAlign: "center",
              marginTop: "20px",
            }}
          >
            ยังไม่มีข้อความ เป็นคนแรกที่พูดสิ!
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ fontSize: "13px", lineHeight: 1.5 }}>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
              {msg.username}
            </span>
            <span style={{ color: "var(--text-muted)" }}>: </span>
            <span style={{ color: "var(--text-primary)" }}>{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        {user ? (
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              ref={inputRef}
              className="input-base"
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์ข้อความ..."
              maxLength={200}
              style={{
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                fontSize: "13px",
              }}
            />
            <button
              onClick={sendMessage}
              className="btn-primary"
              style={{
                width: "auto",
                padding: "0 14px",
                fontSize: "13px",
                borderRadius: "var(--radius-sm)",
              }}
            >
              ส่ง
            </button>
          </div>
        ) : (
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            <a href="/login" style={{ color: "var(--accent)" }}>
              เข้าสู่ระบบ
            </a>{" "}
            เพื่อร่วมแชท
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: "500px",
    background: "var(--bg-secondary)",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    overflow: "hidden",
  },
  header: {
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  messageList: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  inputArea: {
    padding: "12px 16px",
    borderTop: "1px solid var(--border)",
  },
};
