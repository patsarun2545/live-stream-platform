"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import VideoPlayer from "@/components/VideoPlayer";
import ChatBox from "@/components/ChatBox";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Avatar, Tag } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

export default function WatchClient({ slug }) {
  const { user } = useAuth();
  const [video, setVideo] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const commentRef = useRef(null);

  const loadComments = useCallback(
    async (page = 1, append = false) => {
      if (!video?._id) return;
      setLoadingComments(true);
      try {
        const { data } = await axios.get(
          `/api/videos/${video._id}/comments?page=${page}&limit=20`,
        );
        if (append) {
          setComments((prev) => [...prev, ...data.comments]);
        } else {
          setComments(data.comments);
        }
        setCommentsTotal(data.total);
        setCommentsHasMore(data.hasMore);
        setCommentsPage(data.page);
      } catch (err) {
        console.error("Failed to load comments:", err);
      } finally {
        setLoadingComments(false);
      }
    },
    [video?._id],
  );

  useEffect(() => {
    axios
      .get(`/api/videos/${slug}`)
      .then((res) => {
        setVideo(res.data.video);
        setLiked(res.data.video.isLiked || false);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (video?._id) {
      loadComments(1, false);
    }
  }, [video?._id, loadComments]);

  // Viewer beacon effect
  useEffect(() => {
    if (!video?._id) return;

    // Join viewer count on mount
    const joinViewer = async () => {
      try {
        const { data } = await axios.post(
          `/api/videos/${video._id}/viewers/join`,
        );
        setVideo((v) => ({ ...v, viewerCount: data.viewerCount }));
      } catch {
        /* silent */
      }
    };

    joinViewer();

    // Leave viewer count on unmount using sendBeacon
    const leaveViewer = () => {
      const data = new Blob([JSON.stringify({})], { type: "application/json" });
      if (video?._id) navigator.sendBeacon(`/api/videos/${video._id}/viewers/leave`, data);
    };

    return leaveViewer;
  }, [video?._id]);

  const handleLike = async () => {
    if (liked || !user) return;
    try {
      await axios.post(`/api/videos/${video._id}/like`);
      setVideo((v) => ({ ...v, likes: v.likes + 1 }));
      setLiked(true);
    } catch {
      /* silent */
    }
  };

  const handleComment = async () => {
    if (!comment.trim() || !user || posting) return;
    setPosting(true);
    try {
      const { data } = await axios.post(`/api/videos/${video._id}/comments`, {
        text: comment.trim(),
      });
      // Prepend new comment to state without refetching
      setComments((prev) => [data.comment, ...prev]);
      setCommentsTotal((prev) => prev + 1);
      setComment("");
      commentRef.current?.focus();
    } catch (err) {
      alert(err.response?.data?.message || "เกิดข้อผิดพลาด");
    } finally {
      setPosting(false);
    }
  };

  const handleLoadMoreComments = () => {
    loadComments(commentsPage + 1, true);
  };

  if (loading) return <WatchSkeleton />;

  if (!video)
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <p style={{ fontSize: "40px", marginBottom: "16px" }}>🔍</p>
        <p style={{ color: "var(--text-muted)" }}>ไม่พบ stream นี้</p>
      </div>
    );

  return (
    <div
      className="container"
      style={{
        paddingTop: "20px",
        paddingBottom: "40px",
        animation: "fadeIn 200ms ease-in",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* Left: Player + Info + Comments */}
        <div>
          <ErrorBoundary
            fallback={
              <div
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius)",
                  padding: "40px 20px",
                  textAlign: "center",
                  border: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    fontSize: "32px",
                    marginBottom: "12px",
                    display: "block",
                  }}
                >
                  📡
                </span>
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                  ไม่สามารถโหลดวิดีโอได้ กรุณารีโหลดหน้า
                </p>
              </div>
            }
          >
            <VideoPlayer hlsUrl={video.hlsUrl} />
          </ErrorBoundary>
          <StreamInfo
            video={video}
            liked={liked}
            user={user}
            onLike={handleLike}
          />
          <CommentsSection
            comments={comments}
            commentsTotal={commentsTotal}
            commentsHasMore={commentsHasMore}
            loadingComments={loadingComments}
            user={user}
            comment={comment}
            setComment={setComment}
            posting={posting}
            onSubmit={handleComment}
            onLoadMore={handleLoadMoreComments}
            inputRef={commentRef}
          />
        </div>

        {/* Right: Live Chat */}
        <div style={{ position: "sticky", top: "76px" }}>
          <ErrorBoundary
            fallback={
              <div
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius)",
                  padding: "20px",
                  textAlign: "center",
                  border: "1px solid var(--border)",
                  minHeight: "200px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  แชทไม่พร้อมใช้งานชั่วคราว
                </p>
              </div>
            }
          >
            <ChatBox videoId={video._id} user={user} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

// ─── StreamInfo ──────────────────────────────────────────────────────────────
function StreamInfo({ video, liked, user, onLike }) {
  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <Avatar username={video.streamer?.username} size={48} />

        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "18px", fontWeight: 700, lineHeight: 1.3 }}>
            {video.title}
          </h1>
          <p
            style={{
              color: "var(--accent)",
              fontWeight: 600,
              marginTop: "4px",
              fontSize: "14px",
            }}
          >
            {video.streamer?.username}
          </p>
          <div
            style={{
              display: "flex",
              gap: "16px",
              marginTop: "8px",
              color: "var(--text-muted)",
              fontSize: "13px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span>👁 {video.viewerCount?.toLocaleString() ?? 0} คนดูอยู่</span>
            <span>📊 {video.totalViews?.toLocaleString() ?? 0} วิวสะสม</span>
            <span className="badge-live">LIVE</span>
            <Tag>{video.category}</Tag>
          </div>
        </div>

        <button
          onClick={onLike}
          disabled={liked || !user}
          title={!user ? "กรุณา login เพื่อกด Like" : ""}
          style={{
            background: liked ? "var(--bg-hover)" : "var(--accent)",
            border: "none",
            borderRadius: "var(--radius)",
            padding: "8px 16px",
            color: "#fff",
            fontWeight: 600,
            fontSize: "14px",
            flexShrink: 0,
            cursor: liked || !user ? "default" : "pointer",
            opacity: !user ? 0.5 : 1,
          }}
        >
          {liked ? "❤️ ถูกใจแล้ว" : `❤️ ${video.likes ?? 0}`}
        </button>
      </div>

      {video.description && (
        <p
          style={{
            marginTop: "16px",
            color: "var(--text-muted)",
            fontSize: "14px",
            lineHeight: 1.7,
            padding: "12px 16px",
            background: "var(--bg-card)",
            borderRadius: "var(--radius)",
          }}
        >
          {video.description}
        </p>
      )}

      {video.tags?.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginTop: "12px",
          }}
        >
          {video.tags.map((tag) => (
            <Tag key={tag}>#{tag}</Tag>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CommentsSection ─────────────────────────────────────────────────────────
function CommentsSection({
  comments,
  commentsTotal,
  commentsHasMore,
  loadingComments,
  user,
  comment,
  setComment,
  posting,
  onSubmit,
  onLoadMore,
  inputRef,
}) {
  return (
    <div style={{ marginTop: "28px" }}>
      <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>
        ความคิดเห็น ({commentsTotal ?? 0})
      </h2>

      {user ? (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <Avatar username={user.username} size={36} />
          <div style={{ flex: 1, display: "flex", gap: "8px" }}>
            <input
              ref={inputRef}
              className="input-base"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSubmit()}
              placeholder="เพิ่มความคิดเห็น..."
              maxLength={300}
              style={{ padding: "8px 14px" }}
            />
            <button
              onClick={onSubmit}
              disabled={!comment.trim() || posting}
              className="btn-primary"
              style={{ width: "auto", padding: "0 16px", fontSize: "13px" }}
            >
              {posting ? "..." : "ส่ง"}
            </button>
          </div>
        </div>
      ) : (
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "14px",
            marginBottom: "20px",
          }}
        >
          <a href="/login" style={{ color: "var(--accent)" }}>
            เข้าสู่ระบบ
          </a>{" "}
          เพื่อแสดงความคิดเห็น
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {comments.map((c, i) => (
          <CommentItem key={c._id ?? i} comment={c} />
        ))}
      </div>

      {commentsHasMore && (
        <button
          onClick={onLoadMore}
          disabled={loadingComments}
          style={{
            marginTop: "16px",
            padding: "8px 16px",
            background: "var(--bg-hover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--text-primary)",
            cursor: loadingComments ? "default" : "pointer",
            fontSize: "13px",
            opacity: loadingComments ? 0.5 : 1,
          }}
        >
          {loadingComments ? "กำลังโหลด..." : "โหลดความคิดเห็นเพิ่มเติม"}
        </button>
      )}
    </div>
  );
}

function CommentItem({ comment: c }) {
  return (
    <div style={{ display: "flex", gap: "10px" }}>
      <Avatar username={c.user?.username} size={34} />
      <div>
        <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>
            {c.user?.username ?? "ผู้ใช้"}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
            {new Date(c.createdAt).toLocaleDateString("th-TH")}
          </span>
        </div>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-muted)",
            marginTop: "4px",
            lineHeight: 1.6,
          }}
        >
          {c.text}
        </p>
      </div>
    </div>
  );
}

// ─── WatchSkeleton ─────────────────────────────────────────────────────────────
function WatchSkeleton() {
  return (
    <div
      className="container"
      style={{ paddingTop: "20px", paddingBottom: "40px" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* Left: Player + Info + Comments Skeleton */}
        <div>
          {/* Video Player Skeleton */}
          <div
            style={{
              aspectRatio: "16/9",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          {/* Title Skeleton */}
          <div
            style={{
              width: "60%",
              height: "24px",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-sm)",
              marginTop: "16px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          {/* Streamer Info Skeleton */}
          <div
            style={{
              width: "40%",
              height: "16px",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-sm)",
              marginTop: "8px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>

        {/* Right: Chat Panel Skeleton */}
        <div style={{ position: "sticky", top: "76px" }}>
          <div
            style={{
              height: "500px",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}
