const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 300,
    },
    likes: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Compound index for efficient video comment queries
commentSchema.index({ video: 1, createdAt: -1 });

// Index for querying user's comments
commentSchema.index({ user: 1 });

// Static method to get comments for a video with pagination
commentSchema.statics.getByVideo = async function (videoId, page = 1, limit = 20) {
  const skip = (Number(page) - 1) * Number(limit);

  const [comments, total] = await Promise.all([
    this.find({ video: videoId })
      .populate("user", "username avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    this.countDocuments({ video: videoId }),
  ]);

  const hasMore = skip + Number(limit) < total;

  return {
    comments,
    total,
    page: Number(page),
    limit: Number(limit),
    hasMore,
  };
};

module.exports =
  mongoose.models.Comment || mongoose.model("Comment", commentSchema);
