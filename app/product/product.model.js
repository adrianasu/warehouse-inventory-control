const mongoose = require('mongoose');
const Joi = require('joi');

mongoose.Promise = global.Promise;
const ObjectId = mongoose.Schema.Types.ObjectId;

const manufacturerSchema = mongoose.Schema({
    name: String,
});

const categorySchema = mongoose.Schema({
     name: {
        type: String,
        required: true
    },  
    addedBy: {
        type: ObjectId,
        ref: "User"
    }
})

const productSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    manufacturer: {
        type: ObjectId,
        ref: "Manufacturer"
    },
    model: String,
    consummable: {
            type: Boolean,
            default: false
    },
    minimumRequired: {
        quantity: {
            type: Number,
            default: 0
        },
        units: String
    },
    category: {
        type: ObjectId,
        ref: "Category"
    }
});
 
const ProductJoiSchema = Joi.object().keys({
    _id: Joi.string(),
    name: Joi.string(),
    manufacturer: Joi.object().keys({
        _id: Joi.string(),
        name: Joi.string(),
        __v: Joi.number()
    }),
    model: Joi.string(),
    consummable: Joi.boolean(),
    minimumRequired: Joi.object().keys({
        quantity: Joi.number(),
        units: Joi.string()
    }),
    category: Joi.object().keys({
        _id: Joi.string(),
        name: Joi.string(),
        addedBy: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string().min(1).trim(),
            lastName: Joi.string().min(1).trim(),
            username: Joi.string().min(4).max(30).trim(),
            password: Joi.string().min(7).max(30).trim(),
            accessLevel: Joi.number().optional(),
            __v: Joi.number()
        }),
    }),
    __v: Joi.number()
});

productSchema.methods.serialize = function() {
    return {
        id: this._id,
        name: this.name,
        manufacturer: this.manufacturer,
        model: this.model,
        consummable: this.consummable,
        minimumRequired: this.minimumRequired,
        category: this.category
    }
}

// Define if an product quantity is lower than the minimum required
productSchema.methods.isStockLow = function (product) {
    if (product.count < this.minimumRequired.quantity) {
        return true;
    }
    return false;
}


categorySchema.pre('find', function (next) {
    this.populate('user');
    next();
});

categorySchema.pre('findOne', function (next) {
    this.populate('user');
    next();
});

productSchema.pre('find', function (next) {
    this.populate('manufacturer category');
    next();
});

productSchema.pre('findOne', function (next) {
    this.populate('manufacturer category');
    next();
});


const Manufacturer = mongoose.model( "Manufacturer", manufacturerSchema );
const Product = mongoose.model( "Product", productSchema );
const Category = mongoose.model( "Category", categorySchema );

module.exports = { Product, Category, Manufacturer, ProductJoiSchema };