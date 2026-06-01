"use client";
import { useEffect, useReducer } from "react";
import axios from "axios";
import VideoCard from "@/components/VideoCard";

const CATEGORIES = [
  "ทั้งหมด",
  "gaming",
  "music",
  "education",
  "sports",
  "lifestyle",
];
const LIMIT = 20;

const initialState = {
  videos: [],
  category: "ทั้งหมด",
  search: "",
  query: "",
  page: 1,
  total: 0,
  loading: true,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FILTER":
      return {
        ...state,
        category: action.payload.category,
        query: action.payload.query,
        page: 1,
      };
    case "SET_PAGE":
      return {
        ...state,
        page: action.payload,
      };
    case "FETCH_START":
      return {
        ...state,
        loading: true,
      };
    case "FETCH_SUCCESS":
      return {
        ...state,
        videos: action.payload.videos,
        total: action.payload.total,
        loading: false,
      };
    case "FETCH_ERROR":
      return {
        ...state,
        loading: false,
      };
    case "SET_SEARCH":
      return {
        ...state,
        search: action.payload,
      };
    default:
      return state;
  }
}

export default function HomeClient() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const fetchVideos = async () => {
      dispatch({ type: "FETCH_START" });
      try {
        const params = { page: state.page, limit: LIMIT };
        if (state.category !== "ทั้งหมด") params.category = state.category;
        if (state.query) params.search = state.query;
        const { data } = await axios.get("/api/videos", { params });
        dispatch({
          type: "FETCH_SUCCESS",
          payload: { videos: data.videos, total: data.total },
        });
      } catch (err) {
        console.error(err);
        dispatch({ type: "FETCH_ERROR" });
      }
    };

    fetchVideos();
  }, [state.category, state.query, state.page]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      dispatch({
        type: "SET_FILTER",
        payload: { category: state.category, query: state.search },
      });
    }, 400);
    return () => clearTimeout(t);
  }, [state.search, state.category]);

  const totalPages = Math.ceil(state.total / LIMIT);

  return (
    <div
      className="container"
      style={{ paddingTop: "24px", paddingBottom: "40px" }}
    >
      {/* Search */}
      <input
        type="search"
        className="input-base"
        placeholder="ค้นหา stream..."
        value={state.search}
        onChange={(e) =>
          dispatch({ type: "SET_SEARCH", payload: e.target.value })
        }
        style={{ marginBottom: "16px", fontSize: "15px" }}
      />

      {/* Category filters */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        {CATEGORIES.map((cat) => {
          const active = cat === state.category;
          return (
            <button
              key={cat}
              onClick={() =>
                dispatch({
                  type: "SET_FILTER",
                  payload: { category: cat, query: state.query },
                })
              }
              style={{
                background: active ? "var(--accent)" : "var(--bg-card)",
                border: `1px solid ${active ? "var(--accent)" : "var(--border-input)"}`,
                color: active ? "#fff" : "var(--text-muted)",
                padding: "6px 14px",
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: active ? 600 : 400,
                transition: `all var(--transition)`,
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {state.loading ? (
        <SkeletonGrid />
      ) : state.videos.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {state.videos.map((v) => (
              <VideoCard key={v._id} video={v} />
            ))}
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
                marginTop: "32px",
              }}
            >
              <PageButton
                onClick={() =>
                  dispatch({ type: "SET_PAGE", payload: state.page - 1 })
                }
                disabled={state.page === 1}
              >
                ← ก่อนหน้า
              </PageButton>
              <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                {state.page} / {totalPages}
              </span>
              <PageButton
                onClick={() =>
                  dispatch({ type: "SET_PAGE", payload: state.page + 1 })
                }
                disabled={state.page === totalPages}
              >
                ถัดไป →
              </PageButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
      }}
    >
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius)",
            aspectRatio: "16/9",
            animation: `pulse 1.5s ease-in-out ${i * 0.08}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "80px 0",
        color: "var(--text-muted)",
      }}
    >
      <p style={{ fontSize: "40px", marginBottom: "16px" }}>📭</p>
      <p style={{ fontSize: "16px", marginBottom: "8px" }}>
        ไม่มี stream ออนไลน์ตอนนี้
      </p>
      <p style={{ fontSize: "13px" }}>ลองเปลี่ยนหมวดหมู่หรือค้นหาใหม่</p>
    </div>
  );
}

function PageButton({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-secondary"
      style={{
        color: disabled ? "var(--text-dim)" : "var(--text-primary)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}
