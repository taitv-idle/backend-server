const {Schema, model} = require("mongoose");
const {createSlug} = require('../utils/createSlug');

const productSchema = new Schema({
    sellerId: {
        type: Schema.ObjectId,
        required : true
    },
    name: {
        type: String,
        required : true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        index: true,
        validate: {
            validator: (v) => /^[a-z0-9-]+$/.test(v),
            message: 'Slug không hợp lệ'
        }
    },
    category: {
        type: String,
        required : true
    },
    brand: {
        type: String,
        required : true
    },
    price: {
        type: Number,
        required : true
    },
    stock: {
        type: Number,
        required : true
    },
    discount: {
        type: Number,
        required : true
    },
    description: {
        type: String,
        required : true
    },
    shopName: {
        type: String,
        required : true
    },
    images: {
        type: Array,
        required : true
    },
    size: {
        type: [String],
        required: true
    },
    color: {
        type: [String],
        required: true
    },
    tags: {
        type: [String],
        default: []
    },
    rating: {
        type: Number,
        default : 0
    },
    sold: {
        type: Number,
        default: 0
    } 
     
}, {timestamps: true})

productSchema.index({
    name: 'text',
    category: 'text',
    brand: 'text',
    description: 'text',
    tags: 'text'
},{
    weights: {
        name: 5,
        category: 4,
        brand: 3,
        description: 2,
        tags: 4
    }
})

// Middleware tự động tạo slug trước khi save
productSchema.pre('save', async function(next) {
    if (this.isModified('name')) {
        try {
            this.slug = await createSlug(this.name, this.constructor, this._id);
        } catch (error) {
            next(error);
        }
    }
    next();
});

const productModel = model('products', productSchema);
module.exports = productModel;
