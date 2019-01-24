const mongoose = require('mongoose');
const Joi = require('joi');

mongoose.Promise = global.Promise;
const ObjectId = mongoose.Schema.Types.ObjectId;

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
    manufacturer: Joi.string(),
    model: Joi.string(),
    consummable: Joi.boolean(),
    minimumRequired: Joi.object().keys({
        quantity: Joi.number(),
        units: Joi.string()
    }),
    category: Joi.string(),
    __v: Joi.number()
});

productSchema.methods.serialize = function() {
    return {
        id: this._id,
        name: this.name,
        manufacturer: this.manufacturer.name,
        category: this.category.name,
        model: this.model,
        consummable: this.consummable,
        minimumRequiredQuantity: this.minimumRequired.quantity,
        minimumRequiredUnits: this.minimumRequired.units,
    }
}

// Define if an product quantity is lower than the minimum required
productSchema.methods.isStockLow = function (product) {
    if (product.count < this.minimumRequired.quantity) {
        return true;
    }
    return false;
}


productSchema.pre('find', function (next) {
    this.populate('manufacturer category');
    next();
});

productSchema.pre('findOne', function (next) {
    this.populate('manufacturer category');
    next();
});

const Product = mongoose.model( "Product", productSchema );

module.exports = { Product, ProductJoiSchema };