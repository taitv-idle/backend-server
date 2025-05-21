const formidable = require("formidable");
const { responseReturn } = require("../../utils/response");
const cloudinaryConfig = require('../../config/cloudinary');
const categoryModel = require('../../models/categoryModel');

// Hàm chuyển đổi tiếng Việt có dấu thành không dấu
const removeVietnameseTones = (str) => {
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/[^a-z0-9 ]/g, "");
    str = str.replace(/\s+/g, "-");
    return str;
};

class categoryController {
    // Thêm danh mục
    add_category = async (req, res) => {
        const form = formidable();
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 404, { error: 'Đã xảy ra lỗi khi xử lý biểu mẫu.' });

            const { name } = fields;
            const { image } = files;

            if (!name || !image) {
                return responseReturn(res, 400, { error: 'Tên và ảnh là bắt buộc.' });
            }

            const trimmedName = name.trim();
            const slug = removeVietnameseTones(trimmedName);

            try {
                // Kiểm tra xem tên danh mục đã tồn tại chưa
                const existingCategory = await categoryModel.findOne({ name: trimmedName });
                if (existingCategory) {
                    return responseReturn(res, 400, { error: 'Danh mục với tên này đã tồn tại.' });
                }

                // Tiến hành upload ảnh lên Cloudinary và tạo danh mục mới
                const result = await cloudinaryConfig.uploader.upload(image.filepath, { folder: 'categorys' });
                const category = await categoryModel.create({
                    name: trimmedName,
                    slug,
                    image: result.url
                });
                responseReturn(res, 201, { category, message: 'Thêm danh mục thành công.' });
            } catch (error) {
                responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ.' });
            }
        });
    };

    // Lấy danh sách danh mục
    get_category = async (req, res) => {
        const { page, searchValue, parPage } = req.query;

        try {
            const skipPage = page && parPage ? parseInt(parPage) * (parseInt(page) - 1) : 0;

            let query = {};
            if (searchValue && searchValue.trim() !== '') {
                query = { $text: { $search: searchValue } };
            }

            const categorys = await categoryModel.find(query)
                .skip(skipPage)
                .limit(parseInt(parPage) || 0)
                .sort({ createdAt: -1 });

            const totalCategory = await categoryModel.countDocuments(query);
            responseReturn(res, 200, { categorys, totalCategory });

        } catch (error) {
            console.error('Lỗi khi lấy danh sách danh mục:', error.message);
            responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ.' });
        }
    };

    // Cập nhật danh mục
    update_category = async (req, res) => {
        const form = formidable();
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 404, { error: 'Đã xảy ra lỗi khi xử lý biểu mẫu.' });

            const { name } = fields;
            const { image } = files;
            const { id } = req.params;

            if (!name) {
                return responseReturn(res, 400, { error: 'Tên danh mục là bắt buộc.' });
            }

            const trimmedName = name.trim();
            const slug = trimmedName.split(' ').join('-');
            const updateData = { name: trimmedName, slug };

            try {
                if (image && image.filepath) {
                    const result = await cloudinaryConfig.uploader.upload(image.filepath, { folder: 'categorys' });
                    updateData.image = result.url;
                }

                const category = await categoryModel.findByIdAndUpdate(id, updateData, { new: true });

                if (!category) {
                    return responseReturn(res, 404, { error: 'Không tìm thấy danh mục.' });
                }

                responseReturn(res, 200, { category, message: 'Cập nhật danh mục thành công.' });
            } catch (error) {
                responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ.' });
            }
        });
    };

    // Xóa danh mục
    deleteCategory = async (req, res) => {
        const categoryId = req.params.id;
        try {
            const deletedCategory = await categoryModel.findByIdAndDelete(categoryId);

            if (!deletedCategory) {
                console.warn(`Không tìm thấy danh mục có id: ${categoryId}`);
                return res.status(404).json({ message: 'Không tìm thấy danh mục.' });
            }

            res.status(200).json({ message: 'Xóa danh mục thành công.' });
        } catch (error) {
            console.error(`Lỗi khi xóa danh mục với id ${categoryId}:`, error);
            res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
        }
    };
}

module.exports = new categoryController();