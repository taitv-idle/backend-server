// Sử dụng express-validator nếu cần
let validationResult;
try {
    const expressValidator = require('express-validator');
    validationResult = expressValidator.validationResult;
} catch (error) {
    // Fallback khi không có express-validator
    validationResult = () => ({
        isEmpty: () => true,
        array: () => []
    });
    console.warn('express-validator không được cài đặt. Một số chức năng xác thực có thể không hoạt động.');
}

const { responseReturn } = require('../utils/response');

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if phone number is valid
 */
const validatePhoneNumber = (phone) => {
    // Vietnamese phone number format
    // Mobile: 09xxxxxxx, 03xxxxxxx, 07xxxxxxx, 08xxxxxxx
    // Landline: 02xxxxxxx
    const phoneRegex = /^(0[2|3|7|8|9])+([0-9]{8})$/;
    return phoneRegex.test(phone);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - Contains validation result and error message if any
 */
const validatePassword = (password) => {
    // Kiểm tra độ dài tối thiểu
    if (!password || password.length < 8) {
        return {
            isValid: false,
            message: 'Mật khẩu phải có ít nhất 8 ký tự'
        };
    }

    // Kiểm tra có ít nhất một chữ hoa
    if (!/[A-Z]/.test(password)) {
        return {
            isValid: false,
            message: 'Mật khẩu phải có ít nhất một chữ cái in hoa'
        };
    }

    // Kiểm tra có ít nhất một chữ thường
    if (!/[a-z]/.test(password)) {
        return {
            isValid: false,
            message: 'Mật khẩu phải có ít nhất một chữ cái thường'
        };
    }

    // Kiểm tra có ít nhất một chữ số
    if (!/[0-9]/.test(password)) {
        return {
            isValid: false,
            message: 'Mật khẩu phải có ít nhất một chữ số'
        };
    }

    // Kiểm tra có ít nhất một ký tự đặc biệt
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return {
            isValid: false,
            message: 'Mật khẩu phải có ít nhất một ký tự đặc biệt (!@#$%^&*...)'
        };
    }

    return {
        isValid: true,
        message: 'Mật khẩu hợp lệ'
    };
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if email is valid
 */
const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return emailRegex.test(email);
};

module.exports = {
    // Xử lý kết quả validate
    validate: (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(error => ({
                field: error.param,
                message: error.msg
            }));

            return responseReturn(res, 400, {
                error: 'Dữ liệu không hợp lệ',
                details: errorMessages
            });
        }

        next();
    },

    // Middleware kiểm tra quyền sở hữu tài nguyên
    checkOwnership: (model, paramName = 'id') => {
        return async (req, res, next) => {
            try {
                const resource = await model.findOne({
                    _id: req.params[paramName],
                    user: req.user.id
                });

                if (!resource) {
                    return responseReturn(res, 404, {
                        error: 'Không tìm thấy tài nguyên hoặc không có quyền truy cập'
                    });
                }

                req.resource = resource;
                next();
            } catch (error) {
                console.error('Ownership check error:', error);
                return responseReturn(res, 500, {
                    error: 'Lỗi server khi kiểm tra quyền sở hữu'
                });
            }
        };
    },

    // Middleware kiểm tra mật khẩu
    validatePasswordMiddleware: (req, res, next) => {
        const { password } = req.body;
        const result = validatePassword(password);
        
        if (!result.isValid) {
            return responseReturn(res, 400, { error: result.message });
        }
        
        next();
    },

    // Middleware kiểm tra email
    validateEmailMiddleware: (req, res, next) => {
        const { email } = req.body;
        
        if (!validateEmail(email)) {
            return responseReturn(res, 400, { error: 'Email không hợp lệ' });
        }
        
        next();
    },

    // Middleware kiểm tra số điện thoại
    validatePhoneMiddleware: (req, res, next) => {
        const { phone } = req.body;
        
        if (!validatePhoneNumber(phone)) {
            return responseReturn(res, 400, { error: 'Số điện thoại không hợp lệ' });
        }
        
        next();
    },

    // Export các hàm validate để sử dụng trực tiếp
    validatePhoneNumber,
    validatePassword,
    validateEmail
};