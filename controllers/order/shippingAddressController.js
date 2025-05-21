const ShippingAddress = require('../../models/ShippingAddress');
const { validatePhoneNumber } = require('../../middlewares/validate');

// Lấy danh sách địa chỉ đã lưu của user
exports.getSavedAddresses = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID là bắt buộc'
            });
        }

        const addresses = await ShippingAddress.find({ userId })
            .sort({ isDefault: -1, createdAt: -1 });

        res.status(200).json({
            success: true,
            data: addresses
        });
    } catch (error) {
        console.error('Error in getSavedAddresses:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách địa chỉ'
        });
    }
};

// Lưu địa chỉ mới
exports.saveAddress = async (req, res) => {
    try {
        const {
            userId,
            name,
            phone,
            address,
            province,
            provinceCode,
            city,
            cityCode,
            area,
            areaCode,
            post,
            isDefault
        } = req.body;

        // Validate dữ liệu
        if (!userId || !name || !phone || !address || !province || !provinceCode || !city || !cityCode || !area || !areaCode) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
            });
        }

        // Validate số điện thoại
        if (!validatePhoneNumber(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại không hợp lệ'
            });
        }

        // Tạo địa chỉ mới
        const newAddress = new ShippingAddress({
            userId,
            name,
            phone,
            address,
            province,
            provinceCode,
            city,
            cityCode,
            area,
            areaCode,
            post,
            isDefault: isDefault || false
        });

        await newAddress.save();

        res.status(201).json({
            success: true,
            message: 'Lưu địa chỉ thành công',
            address: newAddress
        });
    } catch (error) {
        console.error('Error in saveAddress:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lưu địa chỉ'
        });
    }
};

// Cập nhật địa chỉ
exports.updateAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const updateData = req.body;

        // Validate số điện thoại nếu có cập nhật
        if (updateData.phone && !validatePhoneNumber(updateData.phone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại không hợp lệ'
            });
        }

        const updatedAddress = await ShippingAddress.findByIdAndUpdate(
            addressId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedAddress) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy địa chỉ'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật địa chỉ thành công',
            address: updatedAddress
        });
    } catch (error) {
        console.error('Error in updateAddress:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật địa chỉ'
        });
    }
};

// Xóa địa chỉ
exports.deleteAddress = async (req, res) => {
    try {
        const { addressId } = req.params;

        const deletedAddress = await ShippingAddress.findByIdAndDelete(addressId);

        if (!deletedAddress) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy địa chỉ'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Xóa địa chỉ thành công'
        });
    } catch (error) {
        console.error('Error in deleteAddress:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa địa chỉ'
        });
    }
};

// Đặt địa chỉ làm mặc định
exports.setDefaultAddress = async (req, res) => {
    try {
        const { addressId } = req.params;

        const address = await ShippingAddress.findById(addressId);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy địa chỉ'
            });
        }

        // Cập nhật tất cả địa chỉ của user thành không mặc định
        await ShippingAddress.updateMany(
            { userId: address.userId },
            { isDefault: false }
        );

        // Đặt địa chỉ hiện tại làm mặc định
        address.isDefault = true;
        await address.save();

        res.status(200).json({
            success: true,
            message: 'Đặt địa chỉ mặc định thành công',
            address
        });
    } catch (error) {
        console.error('Error in setDefaultAddress:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi đặt địa chỉ mặc định'
        });
    }
}; 