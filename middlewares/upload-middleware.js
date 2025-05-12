const multer = require('multer');
const path = require('path');

// Configure multer for profile image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads'); // Save temporarily before uploading to cloudinary
    },
    filename: function (req, file, cb) {
        const uniqueName = `${Date.now()}-${Math.round(
            Math.random() * 1e9
        )}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Filter only image files
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ cho phép tải lên file hình ảnh (jpeg, jpg, png, webp)'), false);
    }
};

// Create multer instance with config
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB max size
    }
});

module.exports = upload; 