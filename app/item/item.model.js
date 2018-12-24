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

const itemSchema = mongoose.Schema({
    barcode: {
        type: Number,
        unique: true
    },
    product: {
        type: ObjectId,
        ref: "Product"
    },
    serialNumber: Number,
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
    checkedOut: {
        employee: {
        type: ObjectId,
        ref: "Employee"
        },
        barcode: Number,
        date: Date,
        status: {
            type: String,
            default: "In-use" // in-use, lost, stolen, broken
        }  
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
    }
});

// define the fields that will be available for advanced search
const searchableFields = ["name", "category", "model", "manufacturer", "warehouse", "consummable", "onShelf"];

const ItemJoiSchema = Joi.object().keys({
    _id: Joi.string(),
    barcode: Joi.number(),
    product: Joi.object().keys({
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
    }),
    serialNumber: Joi.number(),
    registered: Joi.object().keys({
        date: Joi.date(),
        condition: Joi.string()
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

const UpdateItemJoiSchema = Joi.object().keys({
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
        barcode: this.barcode,
        product: this.product,
        serialNumber: this.serialNumber,
        registered: this.registered,
        checkedOut: this.checkedOut,
        checkedIn: this.checkedIn,
        location: this.location
    }
}

itemSchema.methods.calculateUsefulLife = function(){
    if( this.checkedOut.status !== "broken"){
        return "NA";
    }
    // Returns the number of days since its registration until declared as broken
    return Math.floor((this.checkedOut.date - this.registered.date)/(1000*60*60*24));
}

itemSchema.methods.serializeWithUsefulLife = function () {
    return {
        id: this._id,
        name: this.name,
        category: this.category,
        manufacturer: this.manufacturer,
        model: this.model,
        consummable: this.consummable,
        minimumRequired: this.minimumRequired,
        usefulLife: this.calculateUsefulLife()
    }
}

// Instance method to determine if an item is on shelf
itemSchema.methods.isOnShelf = function () {
    if (this.checkedOut.date < this.checkedIn.date) {
        return "true";
    }
    return "false";
}

employeeSchema.pre('find', function (next) {
    this.populate('department');
    next();
});

employeeSchema.pre('findOne', function (next) {
    this.populate('department');
    next();
});

itemSchema.pre( 'find', function( next ){
    this.populate( 'product checkedIn.employee checkedOut.employee' );
    next();
});

itemSchema.pre( 'findOne', function( next ){
    this.populate( 'product checkedIn.employee checkedOut.employee' );
    next();
});

// Define if an item quantity is lower than the minimum required
itemSchema.methods.isStockLow = function(){
    if( actualQty < this.minimumRequired ){
        return true;
    }
    return false;
}

const Item = mongoose.model( "Item", itemSchema );
const Employee = mongoose.model("Employee", employeeSchema);
const Department = mongoose.model("Department", departmentSchema);

module.exports ={
    Item, Employee, Department, searchableFields, ItemJoiSchema, UpdateItemJoiSchema
};