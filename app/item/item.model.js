const mongoose = require('mongoose');
const Joi = require('joi');

mongoose.Promise = global.Promise;
const ObjectId = mongoose.Schema.Types.ObjectId;

const departmentSchema = mongoose.Schema({
    departmentName: {
        type: String,
        required: true,
        unique: true,
        default: "NA"
    }
})

const employeeSchema = mongoose.Schema({
    employeeId: String,
    firstName: String,
    lastName: String,
    department: {
        type: ObjectId,
        ref: "Department"
    }
})

const categorySchema = mongoose.Schema({
    name: String,
    addedBy: {
        type: ObjectId,
        ref: "User"
    }
});

const manufacturerSchema = mongoose.Schema({
    name: String,
});

const itemSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    barcode: {
        type: Number,
        unique: true
    },
    category: {
        type: ObjectId,
        ref: "Category"
    },
    manufacturer: {
        type: ObjectId,
        ref: "Manufacturer"
    },
    model: String,
    serialNumber: Number,
    registered: {
        date: Date,
        condition: {
            type: String,
            default: "New"
        }
    },
    consummable: {
        type: Boolean,
        default: false
    },
    minimumRequired:{
        quantity: { 
            type: Number,
            default: 0
        },
        units: String
    },
    checkedOut: {
        employee: {
        type: ObjectId,
        ref: "Employee"
        },
        barcode: Number,
        date: Date,
        status: String
    },
    checkedIn: {
        employee: {
        type: ObjectId,
        ref: "Employee"
        },
        barcode: Number,
        date: Date
    },
    location: {
        warehouse: String,
        aisle: String,
        shelf: Number,
        bin: Number
    },
});

// define the fields that will be available for advanced search
const searchableFields = ["name", "category", "model", "manufacturer", "warehouse", "consummable", "onShelf"];

const ItemJoiSchema = Joi.object().keys({
    _id: Joi.string(),
    name: Joi.string(),
    barcode: Joi.number(),
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
        __v: Joi.number()
    }),
    manufacturer: Joi.object().keys({
        _id: Joi.string(),
        name: Joi.string(),
        __v: Joi.number()
    }),
    model: Joi.string(),
    serialNumber: Joi.number(),
    registered: Joi.object().keys({
        date: Joi.date(),
        condition: Joi.string()
    }),
    consummable: Joi.boolean(),
    minimumRequired: Joi.object().keys({
        quantity: Joi.number(),
        units: Joi.string()
    }),
    checkedOut: Joi.object().keys({
        employee: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(), 
            department: Joi.object().keys({
                _id: Joi.string(),
                departmentName: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
        date: Joi.date(),
        barcode: Joi.number(),
        status: Joi.string()
    }),
    checkedIn: Joi.object().keys({
        employee: Joi.object().keys({
            _id: Joi.string(),
            firstName: Joi.string(),
            lastName: Joi.string(), 
            department: Joi.object().keys({
                _id: Joi.string(),
                departmentName: Joi.string(),
                __v: Joi.number()
            }),
            __v: Joi.number()
        }),
        date: Joi.date(),
        barcode: Joi.number()
    }),
    location: Joi.object().keys({
        warehouse: Joi.string(),
        aisle: Joi.number(),
        shelf: Joi.number(),
        bin: Joi.number()
    })
})

itemSchema.methods.serialize = function(){
    return {
        id: this._id,
        name: this.name,
        barcode: this.barcode,
        category: this.category,
        manufacturer: this.manufacturer,
        model: this.model,
        serialNumber: this.serialNumber,
        registered: this.registered,
        consummable: this.consummable,
        minimumRequired: this.minimumRequired,
        checkedOut: this.checkedOut,
        checkedIn: this.checkedIn,
        location: this.location
    }
}

employeeSchema.pre('find', function (next) {
    this.populate('department');
    next();
});

employeeSchema.pre('findOne', function (next) {
    this.populate('department');
    next();
});

categorySchema.pre( 'find', function( next ){
    this.populate( 'user' );
    next();
});

categorySchema.pre( 'findOne', function( next ){
    this.populate( 'user' );
    next();
});

itemSchema.pre( 'find', function( next ){
    this.populate( 'category checkedIn.employee checkedOut.employee manufacturer' );
    next();
});

itemSchema.pre( 'findOne', function( next ){
    this.populate( 'category checkedIn.employee checkedOut.employee manufacturer' );
    next();
});

// Instance method to determine if an item is on shelf
itemSchema.methods.isOnShelf = function () {
    if( this.checkedOut.date < this.checkedIn.date ){
        return true;
    }
    return false;
}

// TODO: instance method to calculate the useful life of an item
itemSchema.methods.usefulLife = function( status ){
    if( status === "broken" ){
        return this.checkedOut.date - this.registrationDate;
    };
    return "Unknown";
}

// TODO: define if an item quantity is lower than the minimum required
itemSchema.methods.isStockLow = function( actualQty ){
    if( actualQty < this.minimumRequired ){
        return true;
    }
    return false;
}

const Item = mongoose.model( "Item", itemSchema );
const Category = mongoose.model( "Category", categorySchema );
const Manufacturer = mongoose.model( "Manufacturer", manufacturerSchema );
const Employee = mongoose.model("Employee", employeeSchema);
const Department = mongoose.model("Department", departmentSchema);

module.exports ={
    Item, Category, Manufacturer, Employee, Department, searchableFields, ItemJoiSchema
};