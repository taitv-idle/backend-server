const formidable = require("formidable");
const { responseReturn } = require("../../utiles/response");
const cloudinary = require('cloudinary').v2;
const sellerModel = require('../../models/sellerModel');

class SellerController {

    /**
     * Hàm hỗ trợ để lấy danh sách người bán theo trạng thái (pending, active, deactive),
     * có phân trang và hỗ trợ tìm kiếm.
     * @param {Object} res - Đối tượng phản hồi từ Express.
     * @param {String} status - Trạng thái của người bán: 'pending' | 'active' | 'deactive'.
     * @param {Object} query - Các tham số truy vấn: { page, parPage, searchValue }.
     */
    async fetchSellersByStatus(res, status, query) {
        let { page = 1, parPage = 10, searchValue = '' } = query;
        page = Number(page);
        parPage = Number(parPage);
        const skipPage = parPage * (page - 1);

        // Tạo bộ lọc tìm kiếm theo trạng thái và từ khóa (nếu có)
        const filter = {
            status,
            ...(searchValue ? { $text: { $search: searchValue } } : {})
        };

        try {
            // Lấy danh sách người bán phù hợp
            const sellers = await sellerModel
                .find(filter)
                .skip(skipPage)
                .limit(parPage)
                .sort({ createdAt: -1 });

            // Đếm tổng số người bán phù hợp để phục vụ phân trang
            const totalSeller = await sellerModel.countDocuments(filter);

            responseReturn(res, 200, { sellers, totalSeller });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    /**
     * Lấy danh sách người bán đang chờ duyệt (status = 'pending'), có phân trang và tìm kiếm.
     */
    request_seller_get = async (req, res) => {
        await this.fetchSellersByStatus(res, 'pending', req.query);
    }

    /**
     * Lấy thông tin chi tiết của một người bán theo ID.
     */
    get_seller = async (req, res) => {
        const { sellerId } = req.params;
        try {
            const seller = await sellerModel.findById(sellerId);
            if (!seller) {
                return responseReturn(res, 404, { error: 'Không tìm thấy người bán' });
            }
            responseReturn(res, 200, { seller });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    /**
     * Cập nhật trạng thái của người bán (ví dụ: active, deactive, pending...).
     */
    seller_status_update = async (req, res) => {
        const { sellerId, status } = req.body;

        try {
            await sellerModel.findByIdAndUpdate(sellerId, { status });
            const updatedSeller = await sellerModel.findById(sellerId);

            if (!updatedSeller) {
                return responseReturn(res, 404, { error: 'Không tìm thấy người bán' });
            }

            responseReturn(res, 200, {
                seller: updatedSeller,
                message: 'Cập nhật trạng thái người bán thành công'
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    /**
     * Lấy danh sách người bán đang hoạt động (status = 'active').
     */
    get_active_sellers = async (req, res) => {
        await this.fetchSellersByStatus(res, 'active', req.query);
    }

    /**
     * Lấy danh sách người bán đã bị vô hiệu hóa (status = 'deactive').
     */
    get_deactive_sellers = async (req, res) => {
        await this.fetchSellersByStatus(res, 'deactive', req.query);
    }
}

module.exports = new SellerController();
