const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const manufacturerSchema = mongoose.Schema({
    name: String,
});

manufacturerSchema.methods.serialize = function () {
    return {
        id: this._id,
        name: this.name,
    }
}

const Manufacturer = mongoose.model( "Manufacturer", manufacturerSchema );

module.exports = { Manufacturer };