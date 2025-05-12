const { validationResult } = require('express-validator');
const { responseReturn } = require('../utils/response');

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
    }
};