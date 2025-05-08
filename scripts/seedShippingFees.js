const mongoose = require('mongoose');
const ShippingFee = require('../models/ShippingFee');
require('dotenv').config();

const shippingFees = [
    // Hà Nội
    {
        provinceCode: "01",
        districtCode: "001",
        wardCode: "00001",
        fee: 30000
    },
    {
        provinceCode: "01",
        districtCode: "002",
        wardCode: "00002",
        fee: 30000
    },
    // TP.HCM
    {
        provinceCode: "79",
        districtCode: "001",
        wardCode: "00001",
        fee: 30000
    },
    {
        provinceCode: "79",
        districtCode: "002",
        wardCode: "00002",
        fee: 30000
    },
    // Đà Nẵng
    {
        provinceCode: "48",
        districtCode: "001",
        wardCode: "00001",
        fee: 30000
    },
    {
        provinceCode: "48",
        districtCode: "002",
        wardCode: "00002",
        fee: 30000
    },
    // Cần Thơ
    {
        provinceCode: "92",
        districtCode: "001",
        wardCode: "00001",
        fee: 35000
    },
    {
        provinceCode: "92",
        districtCode: "002",
        wardCode: "00002",
        fee: 35000
    },
    // Hải Phòng
    {
        provinceCode: "31",
        districtCode: "001",
        wardCode: "00001",
        fee: 35000
    },
    {
        provinceCode: "31",
        districtCode: "002",
        wardCode: "00002",
        fee: 35000
    }
];

const seedShippingFees = async () => {
    try {
        // Kết nối database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Đã kết nối database');

        // Xóa dữ liệu cũ
        await ShippingFee.deleteMany({});
        console.log('Đã xóa dữ liệu cũ');

        // Thêm dữ liệu mới
        await ShippingFee.insertMany(shippingFees);
        console.log('Đã thêm dữ liệu phí vận chuyển mẫu');

        // Đóng kết nối
        await mongoose.connection.close();
        console.log('Đã đóng kết nối database');
    } catch (error) {
        console.error('Lỗi khi thêm dữ liệu:', error);
        process.exit(1);
    }
};

seedShippingFees(); 