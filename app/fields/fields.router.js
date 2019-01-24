const express = require('express');

const { HTTP_STATUS_CODES } = require('../config');
// const { jwtPassportMiddleware } = require('../auth/auth.strategy');

const { Category } = require('../category/category.model');
const { Department } = require('../department/department.model');
const { Employee } = require('../employee/employee.model');
const { Item, condition } = require('../item/item.model');
const { Manufacturer } = require('../manufacturer/manufacturer.model');
const { Product } = require('../product/product.model');
const { levels } = require('../user/user.model');


const fieldsRouter = express.Router();

function findAllNamesAndIds( CollectionName ){

    return CollectionName
        .find()
        .sort({ name: 1 })
        .then( allDocuments => {
            if( CollectionName === Employee && allDocuments ){
                return allDocuments.map(docum => {
                    return {
                        name: `${docum.firstName} ${docum.lastName}`,
                        id: docum.employeeId
                    }
                })
            } else if( allDocuments ){
                return allDocuments.map( docum => {
                    return {
                        name: docum.name,
                        id: docum._id
                    }
                })
            } else {
                return [];
            }
        })
}

// get searchable fields: Categories, Products, Manufacturers,
// Employees, Departments, AccessLevels, Units(from Product.minimumRequired)
// and Warehouses
fieldsRouter.get('/', (req, res) => {
    let fields = {};
   
    return findAllNamesAndIds(Category)
        .then( categories =>  {
            fields.category = categories;
            return findAllNamesAndIds(Product);
        })
        .then( products => {
            fields.product = products;
            return findAllNamesAndIds(Manufacturer);
        })
        .then( manufacturers => {
            fields.manufacturer = manufacturers;
            return findAllNamesAndIds(Employee);
        })
        .then(employees => {
            fields.employee = employees;
            return findAllNamesAndIds(Department);
        })
        .then(departments => {
            fields.department = departments;  
            return Item
            .distinct('location.warehouse')
        })
        .then(warehouses => {
            fields.warehouse = warehouses.sort();
            return Product
            .find({"minimumRequired.quantity": { $gt: 0 }})
        })
        .then(products => {
            let units = products.map( product => product.minimumRequired.units )
            // send a list of units with no repeated values
            fields.units = units.filter((unit, index, self) => self.indexOf(unit) === index)
            // send accessLevels
            fields.accessLevel = levels;
            // send condition options for registering items
            fields.condition = condition;
            return res.status(HTTP_STATUS_CODES.OK ).json( fields );
        })
        .catch( err => {
            return res.status( HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR ).json({
                message: 'Something went wrong. Please try again'
            })
        })
})

module.exports = { fieldsRouter };