const mediaService = require("../services/mediaService");

// Upload Controller
exports.uploadController = async (req, res) => {
  try {
    const result = await mediaService.uploadMedia(req);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get All Media Controller
exports.getAllController = async (req, res) => {
  try {
    const result = await mediaService.getUserMedia(req);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete Controller
exports.deleteController = async (req, res) => {
  try {
    const result = await mediaService.deleteMedia(req);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
