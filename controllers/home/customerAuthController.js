const customerModel = require('../../models/customerModel')
const { responseReturn } = require('../../utiles/response')
const bcrypt = require('bcrypt')
const sellerCustomerModel = require('../../models/chat/sellerCustomerModel')
const {createToken} = require('../../utiles/tokenCreate')

class customerAuthController {
    customer_register = async(req, res) => {
        const {name, email, password} = req.body

        try {
            // Validate input
            if (!name || !email || !password) {
                return responseReturn(res, 400, { error: 'Vui lòng điền đầy đủ thông tin' })
            }

            // Check if email already exists
            const customer = await customerModel.findOne({email}) 
            if (customer) {
                return responseReturn(res, 400, { error: 'Email đã được sử dụng' })
            }

            // Create new customer
            const createCustomer = await customerModel.create({
                name: name.trim(),
                email: email.trim(),
                password: await bcrypt.hash(password, 10),
                method: 'manual'
            })

            // Create chat record
            await sellerCustomerModel.create({
                myId: createCustomer.id
            })

            // Generate token
            const token = await createToken({
                id: createCustomer.id,
                name: createCustomer.name,
                email: createCustomer.email,
                method: createCustomer.method 
            })

            // Set cookie
            res.cookie('customerToken', token, {
                expires: new Date(Date.now() + 7*24*60*60*1000),
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
            })

            return responseReturn(res, 201, {
                message: 'Đăng ký thành công',
                token,
                userInfo: {
                    id: createCustomer.id,
                    name: createCustomer.name,
                    email: createCustomer.email
                }
            })

        } catch (error) {
            console.error('Lỗi đăng ký:', error.message)
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' })
        }
    }

    customer_login = async(req, res) => {
        const { email, password } = req.body

        try {
            // Validate input
            if (!email || !password) {
                return responseReturn(res, 400, { error: 'Vui lòng điền đầy đủ thông tin' })
            }

            // Find customer
            const customer = await customerModel.findOne({email}).select('+password')
            if (!customer) {
                return responseReturn(res, 404, { error: 'Email không tồn tại' })
            }

            // Verify password
            const match = await bcrypt.compare(password, customer.password)
            if (!match) {
                return responseReturn(res, 401, { error: 'Mật khẩu không chính xác' })
            }

            // Generate token
            const token = await createToken({
                id: customer.id,
                name: customer.name,
                email: customer.email,
                method: customer.method 
            })

            // Set cookie
            res.cookie('customerToken', token, {
                expires: new Date(Date.now() + 7*24*60*60*1000),
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
            })

            return responseReturn(res, 200, {
                message: 'Đăng nhập thành công',
                token,
                userInfo: {
                    id: customer.id,
                    name: customer.name,
                    email: customer.email
                }
            })

        } catch (error) {
            console.error('Lỗi đăng nhập:', error.message)
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' })
        }
    }

    customer_logout = async(req, res) => {
        try {
            res.cookie('customerToken', "", {
                expires: new Date(Date.now()),
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
            })
            return responseReturn(res, 200, { message: 'Đăng xuất thành công' })
        } catch (error) {
            console.error('Lỗi đăng xuất:', error.message)
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' })
        }
    }
}

module.exports = new customerAuthController() 