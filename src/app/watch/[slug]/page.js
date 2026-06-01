import WatchClient from "./WatchClient";

// Next.js SSR — ดึง video data ฝั่ง server เพื่อ inject meta tags
export async function generateMetadata({ params }) {
  try {
    const res = await fetch(
      `${process.env.SITE_URL}/api/videos/${params.slug}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { title: "ไม่พบ stream" };
    const { video } = await res.json();
    return {
      title: video.title,
      description: video.metaDescription || video.description,
      openGraph: {
        title: video.title,
        description: video.metaDescription,
        images: video.thumbnail ? [video.thumbnail] : [],
        type: "video.other",
      },
      twitter: { card: "summary_large_image", title: video.title },
      alternates: { canonical: `${process.env.SITE_URL}/watch/${params.slug}` },
    };
  } catch {
    return { title: "StreamLive" };
  }
}

// Fetch video data in component body (Next.js caches duplicate fetches)
async function getVideoData(slug) {
  try {
    const res = await fetch(`${process.env.SITE_URL}/api/videos/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const { video } = await res.json();
    return video;
  } catch {
    return null;
  }
}

export default async function WatchPage({ params }) {
  const video = await getVideoData(params.slug);
  const SITE_URL = process.env.SITE_URL || "http://localhost:3001";

  // Don't inject JSON-LD if video not found
  if (!video) {
    return <WatchClient slug={params.slug} />;
  }

  // Format duration for schema.org (PT format)
  const formatDuration = (seconds) => {
    if (!seconds) return undefined;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `PT${hours}H${minutes}M${secs}S`;
    }
    return `PT${minutes}M${secs}S`;
  };

  // VideoObject JSON-LD
  const videoJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.metaDescription || video.description,
    thumbnailUrl: video.thumbnail || `${SITE_URL}/api/og/video/${video._id}`,
    uploadDate: video.startedAt || video.createdAt,
    duration: formatDuration(video.duration),
    embedUrl: `${SITE_URL}/watch/${video.slug}`,
    author: {
      "@type": "Person",
      name: video.streamer?.username || "Unknown",
    },
  };

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Watch",
        item: `${SITE_URL}/watch`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: video.title,
        item: `${SITE_URL}/watch/${video.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(videoJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
      <WatchClient slug={params.slug} />
    </>
  );
}
