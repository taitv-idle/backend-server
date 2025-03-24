const adminModel = require('../models/adminModel');
const bcrypt = require('bcrypt');
const {responseReturn} = require('../utiles/response');
const {createToken} = require('../utiles/tokenCreate');
const req = require("express/lib/request");
const res = require("express/lib/response");

class AuthController {
    admin_login = async (req, res) => {
        const { email, password } = req.body;
        try {
            const admin = await adminModel.findOne({email}).select('+password');

            if(!admin) {
                return responseReturn(
                    res,
                    404,
                    {error: 'Email hoặc mật khẩu không chính xác' }
                );
            }
            const match = await bcrypt.compare(password, admin.password);
            if(!match) {
                return responseReturn(
                    res,
                    404,
                    {error: 'Email hoặc mật khẩu không chính xác'}
                )
            }
            const token = await createToken({
                id: admin._id,
                role: admin.role
            });

            res.cookie('accessToken', token, {
                expires: new Date(Date.now() + 24 * 7 * 60 * 60 * 1000),
            });

            responseReturn(
                res,
                200,
                {
                    message: 'Đăng nhập thành công',
                    token
                }
            );

        }catch(err) {
            console.log(err);
            responseReturn(
                res,
                500,
                {error: err.message}
            );
        }
    };

    getUser = async (req, res) => {
        const {_id, role} = req;
        try {
            if(role === 'admin') {
                const user = await findById(_id);
                responseReturn(
                    res,
                    200,
                    {userInfo: user}
                );
            }

        }catch(err) {
            console.log(err);
            responseReturn(
                res,
                500,
                {error: err.message}
            );
        }
    }
}

module.exports = new AuthController();