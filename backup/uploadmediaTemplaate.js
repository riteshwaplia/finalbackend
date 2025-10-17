
// exports.uploadMedia = async (req) => {
//   const { projectId, businessProfileId } = req.body;
//   const file = req.file; // This is the file object from multer
//   const userId = req.user._id;
//   const tenantId = req.tenant._id;

//   if (!file) {
//     return {
//       status: statusCode.BAD_REQUEST,
//       success: false,
//       message: resMessage.Media_required,
//     };
//   }
//   if (!projectId || !businessProfileId) {
//     return {
//       status: statusCode.BAD_REQUEST,
//       success: false,
//       message: resMessage.Missing_required_fields + " (projectId and businessProfileId are required).",
//     };
//   }

//   let processedFileBuffer = null;
//   let finalMimeType = file.mimetype;
//   let finalFileSize = file.size;

//   try {
//     // NEW: Image processing with sharp for JPGs
//     if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
//       console.log(`[Sharp] Processing image: ${file.originalname} (${file.mimetype})`);
//       try {
//         // Read the original file buffer
//         const originalBuffer = fs.readFileSync(file.path);

//         // Process with sharp: resize (optional, but good for profile pics),
//         // then output as a clean JPG with a specific quality.
//         // This re-encodes the image, often fixing obscure format issues.
//         processedFileBuffer = await sharp(originalBuffer)
//           .resize(300, 300, {
//             fit: sharp.fit.inside, // Ensures image fits within dimensions without cropping
//             withoutEnlargement: true // Prevents enlarging if smaller
//           })
//           .jpeg({ quality: 80, progressive: true }) // Re-encode as JPG, 80% quality, progressive scan
//           .toBuffer();

//         finalMimeType = 'image/jpeg';
//         finalFileSize = processedFileBuffer.length;
//         console.log(`[Sharp] Image processed to JPG. New size: ${finalFileSize} bytes.`);

//       } catch (sharpError) {
//         console.error("[Sharp] Error processing image with sharp, falling back to original file:", sharpError);
//         // If sharp fails, proceed with the original file
//         processedFileBuffer = null;
//       }
//     }

//     const metaCredentials = await getBusinessProfileMetaApiCredentials(
//       businessProfileId,
//       userId,
//       tenantId
//     );
//     if (!metaCredentials.success) {
//       console.warn("Meta credential fetch failed:", metaCredentials.message);
//       return {
//         status: metaCredentials.status || statusCode.BAD_REQUEST,
//         success: false,
//         message: metaCredentials.message,
//       };
//     }

//     const { accessToken, wabaId, facebookUrl, graphVersion } = metaCredentials;

//     console.log("🟡 Resumable Upload params (after processing):", {
//       facebookUrl,
//       graphVersion,
//       appIdUsedForUploads: wabaId,
//       accessToken: !!accessToken,
//       mimeType: finalMimeType,
//       fileSize: finalFileSize,
//     });

//     const initUrl = `${facebookUrl}/${graphVersion}/736244065439007/uploads`;
//     console.log("Resumable Upload Init URL:", initUrl);

//     const initResponse = await axios.post(
//       initUrl,
//       {
//         file_length: finalFileSize,
//         file_type: finalMimeType,
//         messaging_product: 'whatsapp',
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           'Content-Type': 'application/json',
//         }
//       }
//     );

//     console.log("✅ Init upload session response:", initResponse.data);

//     const uploadId = initResponse.data?.id;
//     if (!uploadId) {
//       throw new Error("Upload session ID not received from Meta during initialization.");
//     }

//     const form = new FormData();
//     // Use the processed buffer if available, otherwise read from original path
//     const fileStream = processedFileBuffer ? processedFileBuffer : fs.createReadStream(file.path);

//     form.append("file", fileStream, {
//       filename: file.originalname.replace(/\..+$/, '.jpg'), // Ensure filename ends with .jpg if processed
//       contentType: finalMimeType,
//     });
//     form.append("type", finalMimeType); // Redundant but harmless

//     const uploadUrl = `${facebookUrl}/${graphVersion}/${uploadId}`;
//     console.log("Resumable Upload File URL:", uploadUrl);
//     console.log("Attempting to upload file with Content-Type:", finalMimeType);

//     const uploadResponse = await axios.post(
//       uploadUrl,
//       form,
//       {
//         headers: {
//           ...form.getHeaders(),
//           Authorization: `Bearer ${accessToken}`,
//         },
//         maxContentLength: Infinity,
//         maxBodyLength: Infinity,
//       }
//     );

//     console.log("✅ Media uploaded to Meta:", uploadResponse.data);

//     const hValue = uploadResponse.data?.h;
//     if (!hValue) {
//       throw new Error("Media handle ('h' value) not returned from Meta after resumable upload.");
//     }

//     // Clean up the original uploaded file after successful processing/upload
//     if (fs.existsSync(file.path)) {
//       fs.unlinkSync(file.path);
//     }

//     return {
//       status: statusCode.OK,
//       success: true,
//       message: resMessage.Media_uploaded,
//       id: hValue, // Return the 'h' handle
//       mimeType: finalMimeType,
//       fileSize: finalFileSize,
//     };
//   } catch (error) {
//     // Ensure original file is cleaned up even on error
//     if (file?.path && fs.existsSync(file.path)) {
//       fs.unlinkSync(file.path);
//     }

//     const metaError = error.response?.data?.error || error.message;
//     console.error("❌ Resumable Media upload error:", metaError);
//     console.error("❌ Full error response:", JSON.stringify(error.response?.data || {}));

//     return {
//       status: statusCode.INTERNAL_SERVER_ERROR,
//       success: false,
//       message: `Media upload failed: ${metaError.message || metaError}`,
//       metaError: error.response?.data || null,
//     };
//   }
// };