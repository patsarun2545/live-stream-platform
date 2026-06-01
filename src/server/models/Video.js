const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "กรุณาใส่ชื่อ stream"],
      trim: true,
      maxlength: [100, "ชื่อต้องไม่เกิน 100 ตัวอักษร"],
    },
    description: { type: String, default: "", maxlength: 1000 },
    streamer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hlsUrl: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    category: {
      type: String,
      enum: ["gaming", "music", "education", "sports", "lifestyle", "other"],
      default: "other",
    },
    tags: [{ type: String, trim: true, maxlength: 30 }],
    status: {
      type: String,
      enum: ["live", "ended", "scheduled"],
      default: "live",
    },
    viewerCount: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    duration: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    slug: { type: String, unique: true, sparse: true },
    metaDescription: { type: String, maxlength: 160 },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { timestamps: true },
);

videoSchema.index({ status: 1, createdAt: -1 });
videoSchema.index({ streamer: 1 });
videoSchema.index({ tags: 1 });
videoSchema.index({ title: "text", description: "text" });

videoSchema.pre("save", function () {
  if (this.isNew && this.title && !this.slug) {
    const base = this.title
      .toLowerCase()
      .replace(/[^a-z0-9ก-๙\s]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 60);
    this.slug = `${base}-${this._id.toString().slice(-6)}`;
  }

  if (!this.metaDescription && this.description) {
    this.metaDescription = this.description.substring(0, 157) + "...";
  }
});

videoSchema.statics.getLiveStreams = function (limit = 20) {
  return this.find({ status: "live" })
    .populate("streamer", "username avatar")
    .sort({ viewerCount: -1 })
    .limit(limit)
    .lean();
};

videoSchema.statics.search = function (query, limit = 20) {
  return this.find(
    { $text: { $search: query }, status: "live" },
    { score: { $meta: "textScore" } },
  )
    .sort({ score: { $meta: "textScore" } })
    .populate("streamer", "username avatar")
    .limit(limit)
    .lean();
};

module.exports = mongoose.models.Video || mongoose.model("Video", videoSchema);
