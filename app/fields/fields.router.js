const express = require('express');

const { HTTP_STATUS_CODES } = require('../config');
// const { jwtPassportMiddleware } = require('../auth/auth.strategy');

const { Item, Employee  } = require('../item/item.model');
const { Category, Manufacturer, Product } = require('../product/product.model');

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

// get searchable fields (Categories, Products, Manufacturers,
// Employees and Warehouses)
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
            return Item
                .distinct('location.warehouse')
        })
        .then(warehouses => {
            fields.warehouse = warehouses.sort();
            return res.status(HTTP_STATUS_CODES.OK ).json( fields );
        })
        .catch( err => {
            return res.status( HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR ).json({
                message: 'Something went wrong. Please try again'
            })
        })
     
})

module.exports = { fieldsRouter };