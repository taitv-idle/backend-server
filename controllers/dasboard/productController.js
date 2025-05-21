const formidable = require("formidable");
const { responseReturn } = require("../../utils/response");
const cloudinaryConfig = require('../../config/cloudinary');
const productModel = require('../../models/productModel');
const { createSlug } = require('../../utils/createSlug');

class ProductController {
    add_product = async (req, res) => {
        const { id } = req; // sellerId
        const form = formidable({ multiples: true });

        form.parse(req, async (err, field, files) => {
            if (err) {
                return responseReturn(res, 400, { error: 'Lỗi khi xử lý biểu mẫu' });
            }

            const { name, category, description, stock, price, discount, shopName, brand, size, color, tags } = field;
            const { images } = files;

            if (!name || !category || !price || !stock || !images || !size || !color) {
                return responseReturn(res, 400, { error: 'Vui lòng cung cấp đầy đủ thông tin: tên, danh mục, giá, số lượng, hình ảnh, kích thước, màu sắc' });
            }

            const trimmedName = name.trim();
            // Xử lý description từ ReactQuill - giữ nguyên HTML content
            const processedDescription = description ? description.toString() : '';

            try {
                // Tạo slug hợp lệ
                const slug = await createSlug(trimmedName, productModel);

                let allImageUrl = [];
                const imageFiles = Array.isArray(images) ? images : [images];

                for (let i = 0; i < imageFiles.length; i++) {
                    const result = await cloudinaryConfig.uploader.upload(imageFiles[i].filepath, { folder: 'products' });
                    allImageUrl.push(result.url);
                }

                // Xử lý size và color thành mảng
                const sizeArray = Array.isArray(size) 
                    ? size 
                    : (typeof size === 'string' && size.startsWith('[') && size.endsWith(']') 
                        ? JSON.parse(size) 
                        : [size]);
                
                const colorArray = Array.isArray(color) 
                    ? color 
                    : (typeof color === 'string' && color.startsWith('[') && color.endsWith(']') 
                        ? JSON.parse(color) 
                        : [color]);
                
                // Xử lý tags thành mảng
                const tagsArray = tags 
                    ? (Array.isArray(tags) 
                        ? tags 
                        : (typeof tags === 'string' && tags.startsWith('[') && tags.endsWith(']') 
                            ? JSON.parse(tags) 
                            : [tags])) 
                    : [];

                const product = await productModel.create({
                    sellerId: id,
                    name: trimmedName,
                    slug,
                    shopName: shopName?.trim(),
                    category: category.trim(),
                    description: processedDescription,
                    stock: parseInt(stock),
                    price: parseInt(price),
                    discount: parseInt(discount) || 0,
                    images: allImageUrl,
                    brand: brand?.trim(),
                    size: sizeArray,
                    color: colorArray,
                    tags: tagsArray
                });

                responseReturn(res, 201, { product, message: 'Thêm sản phẩm thành công' });
            } catch (error) {
                responseReturn(res, 500, { error: 'Lỗi server khi thêm sản phẩm: ' + error.message });
            }
        });
    };

    products_get = async (req, res) => {
        const { page, searchValue, parPage, tagFilter } = req.query;
        const { id } = req;
        const skipPage = parseInt(parPage) * (parseInt(page) - 1);

        try {
            let products, totalProduct;
            let query = { sellerId: id };

            // Tìm kiếm theo tag nếu có
            if (tagFilter) {
                query.tags = { $in: Array.isArray(tagFilter) ? tagFilter : [tagFilter] };
            }

            if (searchValue) {
                // Kết hợp tìm kiếm text với điều kiện tag (nếu có)
                query.$text = { $search: searchValue };
                
                products = await productModel.find(query)
                    .skip(skipPage)
                    .limit(parseInt(parPage))
                    .sort({ createdAt: -1 });
                    
                totalProduct = await productModel.find(query).countDocuments();
            } else {
                products = await productModel.find(query)
                    .skip(skipPage)
                    .limit(parseInt(parPage))
                    .sort({ createdAt: -1 });
                    
                totalProduct = await productModel.find(query).countDocuments();
            }

            responseReturn(res, 200, { products, totalProduct });
        } catch (error) {
            responseReturn(res, 500, { error: 'Lỗi server khi lấy danh sách sản phẩm: ' + error.message });
        }
    };

    product_delete = async (req, res) => {
        const { productId } = req.params;
        const { id } = req;

        console.log('Received productId:', productId);
        console.log('Seller ID from token:', id);

        try {
            const product = await productModel.findOneAndDelete({
                _id: productId,
                sellerId: id
            });

            if (!product) {
                console.log('Không tìm thấy sản phẩm với _id:', productId, 'và sellerId:', id);
                return responseReturn(res, 404, {
                    error: 'Sản phẩm không tồn tại hoặc không thuộc quyền quản lý của bạn'
                });
            }

            console.log('Đã xóa sản phẩm:', product);
            return responseReturn(res, 200, {
                message: 'Xóa sản phẩm thành công',
                productId: product._id.toString()
            });
        } catch (error) {
            console.error('Lỗi khi xóa sản phẩm:', error);
            return responseReturn(res, 500, {
                error: 'Lỗi server khi xóa sản phẩm: ' + error.message
            });
        }
    }

    product_details = async (req, res) => {
        const { productId } = req.params;
        const { id } = req;

        try {
            const product = await productModel.findOne({ _id: productId, sellerId: id });
            if (!product) {
                return responseReturn(res, 404, { error: 'Sản phẩm không tồn tại hoặc không thuộc quyền quản lý của bạn' });
            }
            responseReturn(res, 200, { product });
        } catch (error) {
            responseReturn(res, 500, { error: 'Lỗi server khi lấy chi tiết sản phẩm: ' + error.message });
        }
    };

    product_update = async (req, res) => {
        const { name, description, stock, price, category, discount, brand, productId, size, color, tags } = req.body;
        if (!productId || !name || !category || !price || !stock || !size || !color) {
            return responseReturn(res, 400, { error: 'Vui lòng cung cấp đầy đủ thông tin: productId, tên, danh mục, giá, số lượng, kích thước, màu sắc' });
        }

        const trimmedName = name.trim();
        // Xử lý description từ ReactQuill - giữ nguyên HTML content
        const processedDescription = description ? description.toString() : '';

        try {
            // Tạo slug hợp lệ
            const slug = await createSlug(trimmedName, productModel, productId);

            // Xử lý size và color thành mảng
            const sizeArray = Array.isArray(size) 
                ? size 
                : (typeof size === 'string' && size.startsWith('[') && size.endsWith(']') 
                    ? JSON.parse(size) 
                    : [size]);
            
            const colorArray = Array.isArray(color) 
                ? color 
                : (typeof color === 'string' && color.startsWith('[') && color.endsWith(']') 
                    ? JSON.parse(color) 
                    : [color]);
            
            // Xử lý tags thành mảng
            const tagsArray = tags 
                ? (Array.isArray(tags) 
                    ? tags 
                    : (typeof tags === 'string' && tags.startsWith('[') && tags.endsWith(']') 
                        ? JSON.parse(tags) 
                        : [tags])) 
                : [];

            const product = await productModel.findByIdAndUpdate(
                productId,
                {
                    name: trimmedName,
                    slug,
                    description: processedDescription,
                    stock: parseInt(stock),
                    price: parseInt(price),
                    category: category.trim(),
                    discount: parseInt(discount) || 0,
                    brand: brand?.trim(),
                    size: sizeArray,
                    color: colorArray,
                    tags: tagsArray
                },
                { new: true }
            );

            if (!product) {
                return responseReturn(res, 404, { error: 'Sản phẩm không tồn tại' });
            }

            responseReturn(res, 200, { product, message: 'Cập nhật sản phẩm thành công' });
        } catch (error) {
            responseReturn(res, 500, { error: 'Lỗi server khi cập nhật sản phẩm: ' + error.message });
        }
    };

    product_image_update = async (req, res) => {
        const form = formidable({ multiples: true });

        form.parse(req, async (err, field, files) => {
            const { oldImage, productId } = field;
            const { newImage } = files;

            if (err || !oldImage || !newImage || !productId) {
                return responseReturn(res, 400, { error: 'Vui lòng cung cấp đầy đủ: hình ảnh cũ, hình ảnh mới, productId' });
            }

            try {
                const product = await productModel.findById(productId);
                if (!product) {
                    return responseReturn(res, 404, { error: 'Sản phẩm không tồn tại' });
                }

                const index = product.images.findIndex(img => img === oldImage);
                if (index === -1) {
                    return responseReturn(res, 400, { error: 'Hình ảnh cũ không tồn tại trong danh sách' });
                }

                const result = await cloudinaryConfig.uploader.upload(newImage.filepath, { folder: 'products' });
                product.images[index] = result.url;

                await product.save();
                responseReturn(res, 200, { product, message: 'Cập nhật hình ảnh sản phẩm thành công' });
            } catch (error) {
                responseReturn(res, 500, { error: 'Lỗi server khi cập nhật hình ảnh: ' + error.message });
            }
        });
    };

    discount_products_get = async (req, res) => {
        const { page, searchValue, parPage, minDiscount, tagFilter } = req.query;
        const { id } = req;
        const skipPage = parseInt(parPage) * (parseInt(page) - 1);
        const minDiscountValue = parseInt(minDiscount) || 10;

        try {
            let query = {
                sellerId: id,
                discount: { $gte: minDiscountValue }
            };

            // Tìm kiếm theo tag nếu có
            if (tagFilter) {
                query.tags = { $in: Array.isArray(tagFilter) ? tagFilter : [tagFilter] };
            }

            if (searchValue) {
                query.$text = { $search: searchValue };
            }

            const products = await productModel.find(query)
                .skip(skipPage)
                .limit(parseInt(parPage))
                .sort({ createdAt: -1 });
            const totalProducts = await productModel.find(query).countDocuments();

            responseReturn(res, 200, { products, totalProducts });
        } catch (error) {
            responseReturn(res, 500, { error: 'Lỗi khi lấy danh sách sản phẩm giảm giá: ' + error.message });
        }
    };
}

module.exports = new ProductController();
