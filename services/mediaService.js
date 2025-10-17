const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");
const Media = require("../models/Media");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

exports.uploadMedia = async (req) => {
  const userId = req.user._id;

  if (!req.file) throw new Error("No file uploaded");

  const MAX_SIZE = 10 * 1024 * 1024;
  if (req.file.size > MAX_SIZE) {
    throw new Error("File size must be less than or equal to 10MB");
  }

  const mimetype = req.file.mimetype;
  let resourceType = "image";
  let fileType = "image";

  if (mimetype.startsWith("video")) {
    resourceType = "video";
    fileType = "video";
  } else if (mimetype.startsWith("application") || mimetype.startsWith("text")) {
    resourceType = "raw"; 
    fileType = "document";
  }

  const result = await new Promise((resolve, reject) => {
    let stream = cloudinary.uploader.upload_stream(
      {
        folder: "chat_uploads",
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(req.file.buffer).pipe(stream);
  });

  const media = await Media.create({
    url: result.secure_url,
    publicId: result.public_id,
    type: fileType, 
    uploadedBy: userId,
    size: req.file.size,
  });

  return { success: true, message: "Media uploaded successfully", data: media };
};
exports.getUserMedia = async (req) => {
  const userId = req.user._id;
  const media = await Media.find({ uploadedBy: userId }).sort({ createdAt: -1 });

  return { success: true, message: "Media fetched successfully", data: media };
};
exports.deleteMedia = async (req) => {
  const { id } = req.params;
  const userId = req.user._id;

  const media = await Media.findOne({ _id: id, uploadedBy: userId });
  if (!media) throw new Error("Media not found");

  await cloudinary.uploader.destroy(media.publicId);

  await media.deleteOne();

  return { success: true, message: "Media deleted successfully" };
};
