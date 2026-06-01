"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/hooks/useAuth";
import { FormField, Card, Spinner } from "@/components/ui";

const CATEGORIES = ["gaming", "music", "education", "sports", "lifestyle"];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Redirect to /login if not logged in or not streamer
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "streamer")) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading) return <Spinner />;

  return <DashboardContent userId={user._id} />;
}

function DashboardContent({ userId }) {
  // Section 1: Stream Status
  const [streamStatus, setStreamStatus] = useState({
    live: false,
    viewerCount: 0,
  });
  const [activeVideo, setActiveVideo] = useState(null);

  // Section 2: Stream Key
  const [streamKey, setStreamKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Section 3: Go Live Form
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "gaming",
    tags: [],
  });
  const [tagInput, setTagInput] = useState("");
  const [createdVideo, setCreatedVideo] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Section 4: Past Streams
  const [pastStreams, setPastStreams] = useState([]);
  const [pastStreamsLoading, setPastStreamsLoading] = useState(false);

  // Fetch stream key
  useEffect(() => {
    axios
      .get("/api/stream/key")
      .then((res) => setStreamKey(res.data.streamKey))
      .catch(console.error);
  }, []);

  // Poll stream status every 10 seconds
  useEffect(() => {
    if (!streamKey) return;

    const fetchStatus = async () => {
      try {
        const res = await axios.get(`/api/stream/status/${streamKey}`);
        setStreamStatus({
          live: res.data.live,
          viewerCount: res.data.video?.viewerCount || 0,
        });
        if (res.data.video) {
          setActiveVideo(res.data.video);
        } else {
          setActiveVideo(null);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [streamKey]);

  // Fetch past streams
  useEffect(() => {
    setPastStreamsLoading(true);
    axios
      .get("/api/videos", { params: { streamer: userId, status: "ended" } })
      .then((res) => setPastStreams(res.data.videos || []))
      .catch(console.error)
      .finally(() => setPastStreamsLoading(false));
  }, [userId]);

  // Handle reset stream key
  const handleResetKey = async () => {
    const confirmed = confirm(
      "การ reset จะตัด stream ที่กำลัง live อยู่ คุณแน่ใจหรือไม่?",
    );
    if (!confirmed) return;

    setResetLoading(true);
    try {
      const res = await axios.post("/api/stream/key/reset", { confirm: true });
      setStreamKey(res.data.streamKey);
      setActiveVideo(null);
      setStreamStatus({ live: false, viewerCount: 0 });
      alert("รีเซ็ต stream key สำเร็จ");
    } catch (err) {
      alert(err.response?.data?.message || "เกิดข้อผิดพลาด");
    } finally {
      setResetLoading(false);
    }
  };

  // Handle copy to clipboard
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert("คัดลอกแล้ว!");
  };

  // Handle add tag
  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag] });
      setTagInput("");
    }
  };

  // Handle remove tag
  const handleRemoveTag = (tag) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });
  };

  // Handle submit go live form
  const handleSubmitGoLive = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError("กรุณาใส่ชื่อ stream");
      return;
    }

    setFormLoading(true);
    setFormError("");
    try {
      const res = await axios.post("/api/videos", {
        title: form.title,
        description: form.description,
        category: form.category,
        tags: form.tags,
      });
      setCreatedVideo(res.data.video);
      alert("สร้าง stream สำเร็จ!");
    } catch (err) {
      setFormError(err.response?.data?.message || "เกิดข้อผิดพลาด");
    } finally {
      setFormLoading(false);
    }
  };

  // Handle end stream
  const handleEndStream = async () => {
    if (!activeVideo) return;
    if (!confirm("จบ stream นี้?")) return;

    try {
      await axios.patch(`/api/videos/${activeVideo.slug || activeVideo._id}`, {
        status: "ended",
      });
      setActiveVideo(null);
      setStreamStatus({ live: false, viewerCount: 0 });
      alert("จบ stream สำเร็จ");
    } catch (err) {
      alert(err.response?.data?.message || "เกิดข้อผิดพลาด");
    }
  };

  // Format duration
  const formatDuration = (startedAt, endedAt) => {
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const diff = Math.floor((end - start) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    if (hours > 0) return `${hours}ชม ${minutes}นาที`;
    return `${minutes}นาที`;
  };

  return (
    <div
      className="container"
      style={{ paddingTop: "32px", paddingBottom: "48px", maxWidth: "900px" }}
    >
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "32px" }}>
        Dashboard
      </h1>

      {/* Section 1: Stream Status */}
      <Card style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
          สถานะ Stream
        </h2>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              className="badge-live"
              style={{
                background: streamStatus.live ? "var(--danger)" : "#666",
                padding: "4px 12px",
                fontSize: "12px",
              }}
            >
              {streamStatus.live ? "LIVE" : "OFFLINE"}
            </span>
            {streamStatus.live && (
              <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                👁 {streamStatus.viewerCount.toLocaleString()} คนดูอยู่
              </span>
            )}
          </div>
          {streamStatus.live && activeVideo && (
            <button
              onClick={handleEndStream}
              style={{
                background: "var(--danger)",
                border: "none",
                borderRadius: "var(--radius)",
                padding: "8px 16px",
                color: "#fff",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              ⏹ End Stream
            </button>
          )}
        </div>
      </Card>

      {/* Section 2: Stream Key */}
      <Card style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
          Stream Key
        </h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <code
            style={{
              flex: 1,
              background: "var(--bg-input)",
              border: "1px solid var(--border-input)",
              borderRadius: "var(--radius)",
              padding: "10px 14px",
              fontSize: "14px",
              color: "var(--accent)",
              wordBreak: "break-all",
              filter: showKey ? "none" : "blur(6px)",
              userSelect: showKey ? "text" : "none",
              transition: "filter 0.2s",
            }}
          >
            {streamKey ? `sk_${streamKey.slice(3)}****` : "กำลังโหลด..."}
          </code>
          <button
            className="btn-secondary"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? "🙈" : "👁"}
          </button>
          <button
            className="btn-secondary"
            onClick={() => handleCopy(streamKey)}
            disabled={!streamKey}
          >
            📋
          </button>
          <button
            className="btn-secondary"
            onClick={handleResetKey}
            disabled={resetLoading || !streamKey}
            style={{
              borderColor: "var(--danger)",
              color: "var(--danger)",
            }}
          >
            {resetLoading ? "..." : "🔄 Reset"}
          </button>
        </div>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginTop: "8px",
          }}
        >
          ⚠️ อย่าแชร์ stream key ให้ใคร
        </p>
      </Card>

      {/* Section 3: Go Live Form */}
      <Card style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
          เริ่ม Stream ใหม่
        </h2>
        {createdVideo ? (
          <div>
            <p
              style={{
                color: "var(--success)",
                fontSize: "14px",
                marginBottom: "16px",
              }}
            >
              ✅ สร้าง stream สำเร็จ! ใช้ข้อมูลด้านล่างใน OBS:
            </p>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    marginBottom: "6px",
                  }}
                >
                  RTMP URL
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <code
                    style={{
                      flex: 1,
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-input)",
                      borderRadius: "var(--radius)",
                      padding: "10px 14px",
                      fontSize: "13px",
                      color: "var(--text-primary)",
                      wordBreak: "break-all",
                    }}
                  >
                    rtmp://localhost:1935/live
                  </code>
                  <button
                    className="btn-secondary"
                    onClick={() => handleCopy("rtmp://localhost:1935/live")}
                  >
                    📋
                  </button>
                </div>
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    marginBottom: "6px",
                  }}
                >
                  Stream Key
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <code
                    style={{
                      flex: 1,
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-input)",
                      borderRadius: "var(--radius)",
                      padding: "10px 14px",
                      fontSize: "13px",
                      color: "var(--accent)",
                      wordBreak: "break-all",
                    }}
                  >
                    {streamKey}
                  </code>
                  <button
                    className="btn-secondary"
                    onClick={() => handleCopy(streamKey)}
                  >
                    📋
                  </button>
                </div>
              </div>
              <button
                className="btn-secondary"
                onClick={() => setCreatedVideo(null)}
                style={{ marginTop: "8px" }}
              >
                สร้าง stream ใหม่
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitGoLive}>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <FormField label="ชื่อ Stream" required>
                <input
                  className="input-base"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="เช่น: เล่นเกมสด"
                  maxLength={100}
                />
              </FormField>

              <FormField label="คำอธิบาย">
                <textarea
                  className="input-base"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="อธิบาย stream ของคุณ..."
                  maxLength={500}
                  rows={3}
                  style={{ resize: "vertical", fontFamily: "inherit" }}
                />
              </FormField>

              <FormField label="หมวดหมู่">
                <select
                  className="input-base"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  style={{ cursor: "pointer" }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Tags">
                <div
                  style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
                >
                  <input
                    className="input-base"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="เพิ่ม tag แล้วกด Enter"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleAddTag}
                  >
                    เพิ่ม
                  </button>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: "var(--accent-light)",
                        color: "var(--accent)",
                        padding: "4px 10px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--accent)",
                          cursor: "pointer",
                          fontSize: "14px",
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </FormField>

              {formError && (
                <p style={{ color: "var(--danger)", fontSize: "14px" }}>
                  {formError}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={formLoading || streamStatus.live}
              >
                {formLoading ? "กำลังสร้าง..." : "🎬 สร้าง Stream"}
              </button>
            </div>
          </form>
        )}
      </Card>

      {/* Section 4: Past Streams */}
      <Card>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
          Stream ที่จบแล้ว
        </h2>
        {pastStreamsLoading ? (
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            กำลังโหลด...
          </p>
        ) : pastStreams.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            ยังไม่มี stream ที่จบแล้ว
          </p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {pastStreams.map((stream) => (
              <div
                key={stream._id}
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius)",
                  padding: "14px",
                  border: "1px solid var(--border)",
                }}
              >
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    marginBottom: "8px",
                  }}
                >
                  {stream.title}
                </h3>
                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                    fontSize: "13px",
                    color: "var(--text-muted)",
                  }}
                >
                  <span>👁 {stream.totalViews?.toLocaleString() || 0} วิว</span>
                  <span>❤️ {stream.likes || 0} likes</span>
                  <span>
                    ⏱{" "}
                    {stream.endedAt
                      ? formatDuration(stream.createdAt, stream.endedAt)
                      : "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
