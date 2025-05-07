const adminModel = require('../models/adminModel');
const sellerModel = require('../models/sellerModel');
const sellerCustomerModel = require('../models/chat/sellerCustomerModel');
const { responseReturn } = require('../utiles/response');
const bcrpty = require('bcrypt');
const { createToken } = require('../utiles/tokenCreate');
const cloudinary = require('cloudinary').v2;
const formidable = require('formidable');

class AuthControllers {
    /**
     * Đăng nhập admin
     */
    admin_login = async (req, res) => {
        const { email, password } = req.body;

        try {
            // Tìm admin theo email, bao gồm cả password (thường bị ẩn trong schema)
            const admin = await adminModel.findOne({ email }).select('+password');

            if (!admin) {
                return responseReturn(res, 404, { error: "Email hoặc mật khẩu không chính xác" });
            }

            // So sánh password nhập vào với password đã hash trong database
            const isPasswordMatch = await bcrpty.compare(password, admin.password);

            if (!isPasswordMatch) {
                return responseReturn(res, 401, { error: "Email hoặc mật khẩu không chính xác" });
            }

            // Tạo token JWT
            const token = await createToken({
                id: admin.id,
                role: admin.role
            });

            // Thiết lập cookie với token
            res.cookie('accessToken', token, {
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
                httpOnly: true, // Bảo mật hơn
                secure: process.env.NODE_ENV === 'production' // Chỉ gửi qua HTTPS trong production
            });

            responseReturn(res, 200, {
                token,
                message: "Đăng nhập admin thành công"
            });

        } catch (error) {
            console.error('Lỗi đăng nhập admin:', error);
            responseReturn(res, 500, { error: "Lỗi máy chủ nội bộ" });
        }
    };

    /**
     * Đăng nhập seller
     */
    seller_login = async (req, res) => {
        const { email, password } = req.body;

        try {
            const seller = await sellerModel.findOne({ email }).select('+password');

            if (!seller) {
                return responseReturn(res, 404, { error: "Email hoặc mật khẩu không chính xác" });
            }

            const isPasswordMatch = await bcrpty.compare(password, seller.password);

            if (!isPasswordMatch) {
                return responseReturn(res, 401, { error: "Email hoặc mật khẩu không chính xác" });
            }

            const token = await createToken({
                id: seller.id,
                role: seller.role
            });

            res.cookie('accessToken', token, {
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
            });

            responseReturn(res, 200, {
                token,
                message: "Đăng nhập seller thành công"
            });

        } catch (error) {
            console.error('Lỗi đăng nhập seller:', error);
            responseReturn(res, 500, { error: "Lỗi máy chủ nội bộ" });
        }
    };

    /**
     * Đăng ký seller
     */
    seller_register = async (req, res) => {
        const { email, name, password } = req.body;

        try {
            // Kiểm tra email đã tồn tại chưa
            const existingSeller = await sellerModel.findOne({ email });

            if (existingSeller) {
                return responseReturn(res, 400, { error: 'Email đã được sử dụng' });
            }

            // Tạo seller mới với password đã hash
            const seller = await sellerModel.create({
                name,
                email,
                password: await bcrpty.hash(password, 10), // Hash password với salt rounds = 10
                method: 'manual',
                shopInfo: {}
            });

            // Tạo bản ghi chat cho seller
            await sellerCustomerModel.create({
                myId: seller.id
            });

            // Tạo token và set cookie
            const token = await createToken({
                id: seller.id,
                role: seller.role
            });

            res.cookie('accessToken', token, {
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
            });

            responseReturn(res, 201, {
                token,
                message: 'Đăng ký seller thành công'
            });

        } catch (error) {
            console.error('Lỗi đăng ký seller:', error);
            responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };

    /**
     * Lấy thông tin user (admin hoặc seller)
     */
    getUser = async (req, res) => {
        const { id, role } = req;

        try {
            let user;

            if (role === 'admin') {
                user = await adminModel.findById(id);
            } else {
                user = await sellerModel.findById(id);
            }

            if (!user) {
                return responseReturn(res, 404, { error: 'Không tìm thấy người dùng' });
            }

            responseReturn(res, 200, { userInfo: user });

        } catch (error) {
            console.error('Lỗi lấy thông tin người dùng:', error);
            responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };

    /**
     * Upload ảnh đại diện
     */
    profile_image_upload = async (req, res) => {
        const { id } = req;

        // Cấu hình Cloudinary
        cloudinary.config({
            cloud_name: process.env.cloud_name,
            api_key: process.env.api_key,
            api_secret: process.env.api_secret,
            secure: true
        });

        const form = formidable({ multiples: true });

        form.parse(req, async (err, _, files) => {
            if (err) {
                console.error('Lỗi phân tích form:', err);
                return responseReturn(res, 400, { error: 'Lỗi khi tải lên hình ảnh' });
            }

            const { image } = files;

            if (!image) {
                return responseReturn(res, 400, { error: 'Không có hình ảnh được tải lên' });
            }

            try {
                // Upload ảnh lên Cloudinary
                const result = await cloudinary.uploader.upload(image.filepath, {
                    folder: 'profile'
                });

                if (!result) {
                    return responseReturn(res, 500, { error: 'Lỗi khi tải lên hình ảnh' });
                }

                // Cập nhật URL ảnh đại diện cho seller
                await sellerModel.findByIdAndUpdate(id, {
                    image: result.secure_url // Sử dụng secure_url để đảm bảo HTTPS
                });

                const userInfo = await sellerModel.findById(id);

                responseReturn(res, 201, {
                    message: 'Tải lên ảnh đại diện thành công',
                    userInfo
                });

            } catch (error) {
                console.error('Lỗi upload ảnh đại diện:', error);
                responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
            }
        });
    };

    /**
     * Thêm thông tin cửa hàng
     */
    profile_info_add = async (req, res) => {
        const { division, district, shopName, sub_district } = req.body;
        const { id } = req;

        try {
            // Cập nhật thông tin cửa hàng
            await sellerModel.findByIdAndUpdate(id, {
                shopInfo: {
                    shopName,
                    division,
                    district,
                    sub_district
                }
            });

            const userInfo = await sellerModel.findById(id);

            responseReturn(res, 201, {
                message: 'Thêm thông tin cửa hàng thành công',
                userInfo
            });

        } catch (error) {
            console.error('Lỗi thêm thông tin cửa hàng:', error);
            responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };

    /**
     * Đăng xuất
     */
    logout = async (req, res) => {
        try {
            // Xóa cookie bằng cách đặt thời gian hết hạn ngay lập tức
            res.cookie('accessToken', null, {
                expires: new Date(Date.now()),
                httpOnly: true
            });

            responseReturn(res, 200, { message: 'Đăng xuất thành công' });

        } catch (error) {
            console.error('Lỗi đăng xuất:', error);
            responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };

    /**
     * Đổi mật khẩu
     */
    change_password = async (req, res) => {
        const { email, old_password, new_password } = req.body;

        try {
            // Tìm seller theo email, bao gồm password
            const user = await sellerModel.findOne({ email }).select('+password');

            if (!user) {
                return responseReturn(res, 404, { error: 'Không tìm thấy người dùng' });
            }

            // Kiểm tra mật khẩu cũ
            const isMatch = await bcrpty.compare(old_password, user.password);

            if (!isMatch) {
                return responseReturn(res, 400, { error: 'Mật khẩu cũ không chính xác' });
            }

            // Hash mật khẩu mới và lưu
            user.password = await bcrpty.hash(new_password, 10);
            await user.save();

            responseReturn(res, 200, { message: 'Đổi mật khẩu thành công' });

        } catch (error) {
            console.error('Lỗi đổi mật khẩu:', error);
            responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };
}

module.exports = new AuthControllers();