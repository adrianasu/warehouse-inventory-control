const mongoose = require('mongoose');
const Joi = require('joi');

mongoose.Promise = global.Promise;
const ObjectId = mongoose.Schema.Types.ObjectId;

// Available options to describe the condition
// of an item at registration time.
const condition = ['New', 'Used', 'Open', 'Broken'];

const itemSchema = mongoose.Schema({
    barcode: {
        type: Number,
        unique: true
    },
    product: {
        type: ObjectId,
        ref: "Product"
    },
    serialNumber: { 
        type: Number,
        default: 0
    },
    registered: {
        date: {
            type: Date,
            default: Date.now()
        },
        condition: {
            type: String,
            default: "New"
        }
    },
    checkedOut: [{
        employee: {
            type: ObjectId,
            ref: "Employee"
        },
        barcode: Number,
        date: Date,
        condition: {
            type: String,
            default: "in-use" // in-use, lost, stolen, broken
        },
        authorizedBy: {
            type: ObjectId,
            ref: "Employee"
        }
    }],
    checkedIn: [{  
        employee: {
            type: ObjectId,
            ref: "Employee"
        },
        barcode: Number,
        date: Date,
        authorizedBy: {
            type: ObjectId,
            ref: "Employee"
        }
    }],
    location: {
        warehouse: String,
        aisle: String,
        shelf: Number,
        bin: Number
    },
   isCheckedOut: Boolean,
});


const ItemJoiSchema = Joi.object().keys({
    __v: Joi.string(),
    _id: Joi.string(),
    barcode: Joi.number().required(),
    product: Joi.string().required(),
    serialNumber: Joi.number(),
    registered: Joi.object().keys({
        date: Joi.date(),
        condition: Joi.string()
    }),
    checkedOut: Joi.array().items(
        Joi.object().keys({
        employee: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(), 
            department: Joi.object().keys({
                _id: Joi.string(),
                name: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
        date: Joi.date(),
        barcode: Joi.number(),
        condition: Joi.string(),
        authorizedBy: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                name: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
    })),
    checkedIn: Joi.array().items(
        Joi.object().keys({
        employee: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(), 
            department: Joi.object().keys({
                _id: Joi.string(),
                name: Joi.string(),
                __v: Joi.number()
        }),
        authorizedBy: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                name: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
            __v: Joi.number()
        }),
        date: Joi.date(),
        barcode: Joi.number()
    })),
    location: Joi.object().keys({
        warehouse: Joi.string().required(),
        aisle: Joi.string(),
        shelf: Joi.number(),
        bin: Joi.number()
    }),
    isCheckedOut: Joi.boolean()
});

const UpdateItemJoiSchema = Joi.object().keys({
    checkedOut: Joi.array().items(
        Joi.object().keys({
        employee: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                name: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
        date: Joi.date(),
        barcode: Joi.number(),
        condition: Joi.string(),
        authorizedBy: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                name: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        })
    })),
    checkedIn: Joi.array().items(
        Joi.object().keys({
        employee: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                name: Joi.string(),
                __v: Joi.number()
            }),
        authorizedBy: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(),
            department: Joi.object().keys({
                _id: Joi.string(),
                name: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
            __v: Joi.number()
        }),
        date: Joi.date(),
        barcode: Joi.number()
    })),
    location: Joi.object().keys({
        warehouse: Joi.string(),
        aisle: Joi.string(),
        shelf: Joi.number(),
        bin: Joi.number()
    })
})


itemSchema.methods.serialize = function(){
    return {
        id: this._id,
        barcode: this.barcode,
        product: this.product,
        serialNumber: this.serialNumber,
        registered: this.registered,
        checkedOut: this.checkedOut,
        checkedIn: this.checkedIn,
        location: this.location,
        isCheckedOut: this.isCheckedOut 
    }
}

itemSchema.methods.serializeAll = function () {
    return {
        id: this._id,
        product: this.product.name,
        barcode: this.barcode,
        model: this.product.model,
        manufacturer: this.product.manufacturer.name,
        category: this.product.category.name,
        serialNumber: this.serialNumber,
        registeredDate: this.registered.date,
        registeredCondition: this.registered.condition,
        checkedOut: this.checkedOut,
        checkedIn: this.checkedIn,
        warehouse: this.location.warehouse,
        aisle: this.location.aisle,
        shelf: this.location.shelf,
        bin: this.location.bin,
        isCheckedOut: this.isCheckedOut,
    }
}

// Returns the number of days since its registration until 
// declared as broken (inside the checkedOut.status field)
itemSchema.methods.calculateUsefulLife = function(){
    if( this.checkedOut.length === 0 ||
        this.checkedOut[this.checkedOut.length-1].condition !== "broken"){
        return "NA";
    }
    return Math.floor((this.checkedOut[this.checkedOut.length - 1].date - this.registered.date) / (1000 * 60 * 60 * 24));
}

itemSchema.methods.serializeWithUsefulLife = function () {
    return {
        id: this._id,
        product: this.product.name,
        barcode: this.barcode,
        model: this.product.model,
        manufacturer: this.product.manufacturer.name,
        category: this.product.category.name,
        serialNumber: this.serialNumber,
        registeredDate: this.registered.date,
        registeredCondition: this.registered.condition,
        checkedOut: this.checkedOut,
        checkedIn: this.checkedIn,
        warehouse: this.location.warehouse,
        usefulLife: this.calculateUsefulLife()
    }
}


// Instance method to determine if an item is on shelf
itemSchema.methods.isOnShelf = function () {
    // If item has never been checked out or if its more recent operation
    // is "checked in" then it will be considered to be on shelf
    if ((this.checkedOut.length === 0 ) 
        || (this.checkedOut.length > 0 && this.checkedIn.length > 0
            && this.checkedOut[0].date < this.checkedIn[0].date) ){
            return "true";
        } 
        return "false";
}
   

itemSchema.pre('save', function (next) {
    if (this.isOnShelf() === "true") {
        this.isCheckedOut = false;
    } else {
        this.isCheckedOut = true;
    }
    next();
});

itemSchema.pre( 'find', function( next ){
    this.populate('product checkedIn.employee checkedOut.employee');
    next();
});

itemSchema.pre( 'findOne', function( next ){
    this.populate('product checkedIn.employee checkedOut.employee checkedIn.authorizedBy checkedOut.authorizedBy');
    next();
});

const Item = mongoose.model( "Item", itemSchema );

module.exports ={
    Item, ItemJoiSchema, UpdateItemJoiSchema, condition 
};