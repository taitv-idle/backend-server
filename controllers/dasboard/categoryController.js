const formidable = require("formidable")
const { responseReturn } = require("../../utiles/response")
const cloudinary = require('cloudinary').v2
const categoryModel = require('../../models/categoryModel')
// Cấu hình Cloudinary một lần
cloudinary.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret,
    secure: true
});
class categoryController{

    add_category = async (req, res) => {
        const form = formidable();
        form.parse(req, async (err, fields, files) => {
            if (err) {
                return responseReturn(res, 404, { error: 'Something went wrong' });
            }
            const { name } = fields;
            const { image } = files;

            if (!name || !image) {
                return responseReturn(res, 400, { error: 'Name and image are required' });
            }

            const trimmedName = name.trim();
            const slug = trimmedName.split(' ').join('-');

            try {
                const result = await cloudinary.uploader.upload(image.filepath, { folder: 'categorys' });
                const category = await categoryModel.create({
                    name: trimmedName,
                    slug,
                    image: result.url
                });
                responseReturn(res, 201, { category, message: 'Category Added Successfully' });
            } catch (error) {
                responseReturn(res, 500, { error: 'Internal Server Error' });
            }
        });
    };



    get_category = async (req, res) => {
       const {page,searchValue, parPage} = req.query

       try {
            let skipPage = ''
            if (parPage && page) {
                skipPage = parseInt(parPage) * (parseInt(page) - 1)
            }

        if (searchValue && page && parPage) {
            const categorys = await categoryModel.find({
                $text: { $search: searchValue }
            }).skip(skipPage).limit(parPage).sort({ createdAt: -1})
            const totalCategory = await categoryModel.find({
                $text: { $search: searchValue }
            }).countDocuments()
            responseReturn(res, 200,{categorys,totalCategory})
        }
        else if(searchValue === '' && page && parPage) {

            const categorys = await categoryModel.find({ }).skip(skipPage).limit(parPage).sort({ createdAt: -1})
            const totalCategory = await categoryModel.find({ }).countDocuments()
            responseReturn(res, 200,{categorys,totalCategory})
        }

        else {

            const categorys = await categoryModel.find({ }).sort({ createdAt: -1})
            const totalCategory = await categoryModel.find({ }).countDocuments()
            responseReturn(res, 200,{categorys,totalCategory})

        }

       } catch (error) {
            console.log(error.message)
       }


    }




    update_category = async (req, res) => {
        const form = formidable();
        form.parse(req, async (err, fields, files) => {
            if (err) {
                return responseReturn(res, 404, { error: 'Something went wrong' });
            }
            const { name } = fields;
            const { image } = files;
            const { id } = req.params;

            if (!name) {
                return responseReturn(res, 400, { error: 'Name is required' });
            }

            const trimmedName = name.trim();
            const slug = trimmedName.split(' ').join('-');
            const updateData = { name: trimmedName, slug };

            try {
                if (image && image.filepath) { // Chỉ cập nhật ảnh nếu có file mới
                    const result = await cloudinary.uploader.upload(image.filepath, { folder: 'categorys' });
                    updateData.image = result.url;
                }
                const category = await categoryModel.findByIdAndUpdate(id, updateData, { new: true });
                if (!category) {
                    return responseReturn(res, 404, { error: 'Category not found' });
                }
                responseReturn(res, 200, { category, message: 'Category Updated Successfully' });
            } catch (error) {
                responseReturn(res, 500, { error: 'Internal Server Error' });
            }
        });
    };


 deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const deleteCategory = await categoryModel.findByIdAndDelete(categoryId);

        if (!deleteCategory) {
            console.log(`Cateogry with id ${categoryId} not found`);
            return res.status(404).json({ message: 'Category not found'});
        }
        res.status(200).json({message: 'Category deleted successfully'});

    } catch (error) {
        console.log(`Error delete category with id ${categoryId}:`,error);
        res.status(500).json({message: 'Internal Server Error'});
    }

 }




}


module.exports = new categoryController()