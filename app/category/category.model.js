const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
const ObjectId = mongoose.Schema.Types.ObjectId;


const categorySchema = mongoose.Schema({
     name: {
        type: String,
        required: true
    },  
    addedBy: {
        type: ObjectId,
        ref: "User"
    }
});

categorySchema.methods.serialize = function () {
        return {
            id: this._id,
            name: this.name,
        }
}

categorySchema.pre('find', function (next) {
    this.populate('user');
    next();
});

categorySchema.pre('findOne', function (next) {
    this.populate('user');
    next();
});

const Category = mongoose.model( "Category", categorySchema );

module.exports = { Category };