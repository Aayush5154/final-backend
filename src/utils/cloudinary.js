import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload function
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // Upload the file to Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    console.log("File uploaded successfully on Cloudinary:", response.url);
    fs.unlinkSync(localFilePath); // now agr succesfully upload ho gyi h To unlink ho jayegi then 
    // Remove the local file after successful upload
    // fs.unlinkSync(localFilePath);
    return response;// response me tumhe url milega 
  } catch (error) {
    console.error("Cloudinary upload failed:", error);

    // Remove local file if upload fails
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return null;
  }
};

// Delete function
const deleteFromCloudinary = async (fileUrl) => {
  try {
    if (!fileUrl) return null;

    // Extract public_id from Cloudinary URL
    // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg
    const urlParts = fileUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');

    if (uploadIndex === -1) {
      console.error("Invalid Cloudinary URL format");
      return null;
    }

    // Get everything after 'upload/v...' (version) or 'upload/'
    let publicIdWithExtension = urlParts.slice(uploadIndex + 1).join('/');

    // Remove version if present (v1234567890/)
    publicIdWithExtension = publicIdWithExtension.replace(/^v\d+\//, '');

    // Remove file extension
    const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.')) || publicIdWithExtension;

    // Determine resource type based on URL
    const resourceType = fileUrl.includes('/video/') ? 'video' : 'image';

    // Delete the file from Cloudinary
    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    console.log("File deleted from Cloudinary:", response);
    return response;
  } catch (error) {
    console.error("Cloudinary deletion failed:", error);
    return null;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary }
