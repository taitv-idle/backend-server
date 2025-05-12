const customerModel = require('../../models/customerModel')
const { responseReturn } = require('../../utiles/response')
const bcrypt = require('bcrypt')
const sellerCustomerModel = require('../../models/chat/sellerCustomerModel')
const {createToken} = require('../../utiles/tokenCreate')
const cloudinary = require('../../config/cloudinary')
const fs = require('fs')

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

    update_user_profile = async (req, res) => {
        try {
            const { id } = req.user;
            const { name, email } = req.body;
            
            // Validate input
            if (!name || !email) {
                return responseReturn(res, 400, { error: 'Tên và email là bắt buộc' });
            }

            // Check if email is already in use by another user
            const existingUser = await customerModel.findOne({ email, _id: { $ne: id } });
            if (existingUser) {
                return responseReturn(res, 400, { error: 'Email đã được sử dụng bởi người dùng khác' });
            }

            // Prepare update data
            const updateData = {
                name,
                email
            };

            // Process image if uploaded
            if (req.file) {
                // Upload to cloudinary
                const { public_id, secure_url } = await cloudinary.uploader.upload(req.file.path, {
                    folder: 'ecommerce/customers'
                });
                
                // Add image to update data
                updateData.image = {
                    public_id,
                    url: secure_url
                };
                
                // Delete local file after upload
                fs.unlinkSync(req.file.path);
                
                // Delete old image if exists
                const customer = await customerModel.findById(id);
                if (customer?.image?.public_id) {
                    await cloudinary.uploader.destroy(customer.image.public_id);
                }
            }
            
            // Update user
            const updatedUser = await customerModel.findByIdAndUpdate(
                id, 
                updateData,
                { new: true, runValidators: true }
            );
            
            if (!updatedUser) {
                return responseReturn(res, 404, { error: 'Không tìm thấy người dùng' });
            }
            
            // Generate new token with updated info
            const token = await createToken({
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                method: updatedUser.method
            });
            
            // Set updated cookie
            res.cookie('customerToken', token, {
                expires: new Date(Date.now() + 7*24*60*60*1000),
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
            });
            
            return responseReturn(res, 200, {
                success: true,
                message: 'Cập nhật thông tin thành công',
                user: {
                    id: updatedUser.id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    image: updatedUser.image?.url || null
                }
            });
            
        } catch (error) {
            console.error('Lỗi cập nhật thông tin:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    }
}

module.exports = new customerAuthController() 