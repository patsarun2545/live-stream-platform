import Link from "next/link";
import Image from "next/image";
import { Avatar, Tag } from "./ui";
import { useState } from "react";

// Base64 1x1 gray pixel for blur placeholder
const blurDataURL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

export default function VideoCard({ video }) {
  const { title, streamer, viewerCount, thumbnail, slug, category } = video;
  const [imageError, setImageError] = useState(false);

  return (
    <Link href={`/watch/${slug}`} style={{ display: "block" }}>
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          transition: `transform var(--transition)`,
          cursor: "pointer",
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            position: "relative",
            aspectRatio: "16/9",
            background: "#111",
          }}
        >
          {thumbnail && !imageError ? (
            <Image
              src={thumbnail}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              style={{ objectFit: "cover" }}
              loading="lazy"
              placeholder="blur"
              blurDataURL={blurDataURL}
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #1a0533, #0d0d1a)",
                fontSize: "36px",
              }}
            >
              🎮
            </div>
          )}
          <span
            className="badge-live"
            style={{ position: "absolute", top: "8px", left: "8px" }}
          >
            LIVE
          </span>
          <span
            style={{
              position: "absolute",
              bottom: "8px",
              left: "8px",
              background: "rgba(0,0,0,0.75)",
              color: "#fff",
              fontSize: "12px",
              padding: "2px 8px",
              borderRadius: "4px",
            }}
          >
            👁 {viewerCount?.toLocaleString() ?? 0} คน
          </span>
        </div>

        {/* Info */}
        <div style={{ padding: "10px 12px" }}>
          <div
            style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
          >
            <Avatar username={streamer?.username} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  marginTop: "2px",
                }}
              >
                {streamer?.username}
              </p>
              <div style={{ marginTop: "4px" }}>
                <Tag>{category}</Tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
