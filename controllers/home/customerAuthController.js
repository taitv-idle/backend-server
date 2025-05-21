const customerModel = require('../../models/customerModel')
const { responseReturn } = require('../../utils/response')
const bcrypt = require('bcrypt')
const sellerCustomerModel = require('../../models/chat/sellerCustomerModel')
const {createToken} = require('../../utils/tokenCreate')
const cloudinaryConfig = require('../../config/cloudinary')
const fs = require('fs')
const { validatePassword, validateEmail } = require('../../middlewares/validate')

class customerAuthController {
    customer_register = async(req, res) => {
        const {name, email, password} = req.body

        try {
            // Validate input
            if (!name || !email || !password) {
                return responseReturn(res, 400, { error: 'Vui lòng điền đầy đủ thông tin' })
            }

            // Validate email format
            if (!validateEmail(email)) {
                return responseReturn(res, 400, { error: 'Email không hợp lệ' })
            }

            // Validate password strength
            const passwordValidation = validatePassword(password)
            if (!passwordValidation.isValid) {
                return responseReturn(res, 400, { error: passwordValidation.message })
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
                method: createCustomer.method,
                image: null
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
                    email: createCustomer.email,
                    image: null
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
                method: customer.method,
                image: customer.image?.url || null
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
                    email: customer.email,
                    image: customer.image?.url || null
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
                try {
                    // Upload to cloudinary
                    const { public_id, secure_url } = await cloudinaryConfig.uploader.upload(req.file.path, {
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
                        await cloudinaryConfig.uploader.destroy(customer.image.public_id);
                    }
                } catch (cloudinaryError) {
                    console.error('Lỗi tải ảnh lên Cloudinary:', cloudinaryError);
                    
                    // Clean up local file if it exists
                    if (req.file && req.file.path) {
                        try {
                            fs.unlinkSync(req.file.path);
                        } catch (unlinkError) {
                            console.error('Không thể xóa file tạm:', unlinkError);
                        }
                    }
                    
                    return responseReturn(res, 500, { 
                        error: 'Lỗi khi tải ảnh lên, vui lòng thử lại sau'
                    });
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
                method: updatedUser.method,
                image: updatedUser.image?.url || null
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
                token,
                userInfo: {
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

    get_current_customer = async(req, res) => {
        try {
            const { id } = req.user;
            
            // Find customer by ID
            const customer = await customerModel.findById(id);
            if (!customer) {
                return responseReturn(res, 404, { error: 'Không tìm thấy thông tin người dùng' });
            }
            
            return responseReturn(res, 200, {
                userInfo: {
                    id: customer.id,
                    name: customer.name,
                    email: customer.email,
                    image: customer.image?.url || null
                }
            });
        } catch (error) {
            console.error('Lỗi lấy thông tin người dùng:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    }
}

module.exports = new customerAuthController() 