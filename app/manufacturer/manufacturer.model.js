const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

const manufacturerSchema = mongoose.Schema({
    name: String,
});

const Manufacturer = mongoose.model( "Manufacturer", manufacturerSchema );

module.exports = { Manufacturer };