const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { Item, Employee } = require('../app/item/item.model');
const { Product } = require('../app/product/product.model')
const { TEST_DATABASE_URL, HTTP_STATUS_CODES } = require('../app/config');
const { app, runServer, closeServer } = require('../app/server');

const { generateTestUser, generateToken, seedUsersDb } = require('./fakeUser');
const { seedItemsDb } = require('./fakeData');

const expect = chai.expect;

// allow us to use chai.request() method
chai.use(chaiHttp);

let testUser, jwToken;
const itemKeys = ["barcode", "serialNumber"];

function insertItems( searchTerm ){
    let newItems = [{
                    barcode: searchTerm,
                    serialNumber: 1230,
                    registered: {
                        date: new Date('2018'),
                        condition: "Broken"
                    }}, 
                 {
                    barcode: 123,
                    serialNumber: searchTerm,
                    registered: {
                        date: new Date('2018'),
                        condition: "In-use"
                    }              
                }];

    return Item.insertMany(newItems)
}

function checkResponse(res, statusCode, resType) {
    expect(res).to.have.status(statusCode);
    expect(res).to.be.json;
    expect(res.body).to.be.a(resType);
}

function checkObjectContent( res, itemKeys, newItem ){
    expect(res.body).to.include.keys(itemKeys);
    itemKeys.forEach( function( key ) {
        expect(res.body[key]).to.equal(newItem[key]);
    });
}

function checkArrayContent( res, itemKeys ){
    expect(res.body).to.have.lengthOf.at.least(1);
    expect(res.body[0]).to.include.keys(itemKeys);
}

function tearDownDb(){
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}
 
describe( 'Items API resource tests', function(){

    before( function(){
        return runServer( TEST_DATABASE_URL )
        .then(() => {
            return tearDownDb();
        }        )
    });

    beforeEach( function(){
        testUser = generateTestUser();
        return generateToken( testUser )
            .then(function( _jwToken ){
                jwToken = _jwToken;
                return seedItemsDb();
            })
        
    });

    afterEach( function(){
        return tearDownDb();
    });

    after( function(){
        return closeServer();
    });

    it( 'Should create a new item', function(){
       let newItem = {
        barcode: 123456,
        serialNumber: 567890,
        registered: {
            date: new Date('2018'),
            condition: "New"
        }
       }
    
        return chai.request( app )
            .post('/api/item')
            .set('Authorization', `Bearer ${ jwToken }`)
            .send( newItem )
            .then( function( res ){
                checkResponse( res, HTTP_STATUS_CODES.CREATED, 'object' );
                checkObjectContent( res, itemKeys, newItem );
            })
            .catch( function( err ){
                console.log( err );
            });
    });

    it("Should not create a new item bc barcode already exists", function(){
        let newItem = {
            serialNumber: 9876,
        }
        
        return Item 
        .findOne()
        .then( item => {
            newItem.barcode = item.barcode;
        
            return chai.request( app )
                .post('/api/item')
                .set('Authorization', `Bearer ${ jwToken }`)
                .send(newItem)
                .then( function( res ){
                    checkResponse( res, HTTP_STATUS_CODES.BAD_REQUEST, 'object' );
                    expect( res.body ).to.include({err: 'An item with that barcode already exists.'});
                })
        })
        .catch( function( err ){
             console.log( err )
        });
    });

    it('Should return all items', function(){
        return chai.request( app )
            .get('/api/item')
            .then( function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'array' );
                checkArrayContent( res, itemKeys );
            })
            .catch( function( err ){
                console.log( err );
            });
    });

    it('Should return at least two items containing the searchTerm in diff properties', function(){
        let searchTerm = 565656;
        return insertItems( searchTerm )
        .then( ids => {
            return chai.request( app )
            .get(`/api/item/search/${searchTerm}`)
    
        })
        .then( function ( res ) {
            checkResponse( res, HTTP_STATUS_CODES.OK, 'array' );
            checkArrayContent( res, itemKeys );
            expect( res.body ).to.have.lengthOf.at.least( 2 );
        })
        .catch( function ( err ) {
            console.log( err );
        });
    })

    it('Advanced search should find an item that contains all the values in the query ', function () {
        let productName;
        let newItem = {
                        serialNumber: 986232,
                        barcode: 123456,
                        location: {
                            warehouse: "Disneyland",
                            aisle: 5,
                            shelf: 3,
                            bin: 10
                        }
        };
        return Product
            .findOne()
        .then( foundProduct => {
            newItem.product = foundProduct._id;
            productName = foundProduct.name;
            return Item
            .create(newItem)
        })
            .then(id => {
            return chai.request(app)
                .get(`/api/item/advancedSearch?warehouse=${newItem.location.warehouse}&product=${productName}`)

            })
            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'array');
                checkArrayContent( res, itemKeys );
            })
            .catch(function (err) {
                console.log(err);
            });
    })

    it('Should return a item by id', function () {

        return Item
            .findOne()
            .then(function (foundItem) {
                return chai.request(app)
                    .get(`/api/item/${foundItem._id}`)
                    .set("Authorization", `Bearer ${jwToken}`)
            })
            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object')
                expect(res.body).to.include.keys(itemKeys);
            })
            .catch(function (err) {
                console.log(err);
            })
    })

    it('Should update item by id', function () {
     
        let updateItem = {
            location: {
                warehouse: "Disneyland",
                aisle: "A",
                shelf: 2,
                bin:3
            }
        }

        return Item
            .findOne()
            .then(function (foundItem) {
                updateItem.id = foundItem.id;
                return chai.request(app)
                    .put(`/api/item/${updateItem.id}`)
                    .set("Authorization", `Bearer ${jwToken}`)
                    .send(updateItem)
            })
            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object')
                expect(res.body.location).to.deep.equal(updateItem.location);
            })
            .catch(function (err) {
                console.log(err);
            });
    });

it('Should delete item by id', function () {

    return Item
        .findOne()
        .then(function (item) {

            return chai.request(app)
                .delete(`/api/item/${item.id}`)
                .set("Authorization", `Bearer ${jwToken}`)
        })
        .then(function (res) {
            checkResponse(res, HTTP_STATUS_CODES.OK, 'object');
            let responseKeys = ["deleted", "OK"];
            expect(res.body).to.include.keys(responseKeys);
        })
        .catch(function (err) {
            console.log(err);
        });
    });

    it('Should return items currently on shelf', function () {
        let onShelf = "true";
            return chai.request(app)
                .get(`/api/item/onShelf/${onShelf}`)
                .set("Authorization", `Bearer ${jwToken}`)
            
            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'array');
                checkArrayContent(res, itemKeys);
                let lastCheckedOut = res.body[0].checkedOut.length-1;
                let lastCheckedIn = res.body[0].checkedIn.length - 1;
                let checkedOut = res.body[0].checkedOut[ lastCheckedOut ].date;
                let checkedIn = res.body[0].checkedIn[ lastCheckedIn ].date;
                expect(checkedIn > checkedOut).to.be.true;
            })
            .catch(function (err) {
                console.log(err);
            });
    })

    it(`Should return items' useful life report`, function () {
    
        return chai.request(app)
            .get(`/api/item/usefulLife`)
            .set("Authorization", `Bearer ${jwToken}`)

            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'array');
                checkArrayContent(res, itemKeys);
                expect(res.body[0]).to.include.keys("usefulLife")
            })
            .catch(function (err) {
                console.log(err);
            });
    })

    // list warehouses
    it(`Should return a list of all warehouses`, function () {
        let newItem = {
            barcode: 00112233,
            serialNumber: 998877,
            location: {
                warehouse: "Disneyland",
                aisle: "A",
                shelf: 2,
                bin: 4
            }

        }
        
        return Item
        .create(newItem)
        .then( id => {       
            return chai.request(app)
            .get(`/api/item/warehouse`)
            .set("Authorization", `Bearer ${jwToken}`)
        })
        .then(function (res) {
            checkResponse(res, HTTP_STATUS_CODES.OK, 'array');
            expect(res.body).to.contain("Disneyland");
        })
        .catch(function (err) {
            console.log(err);
        });
    })

    it('Should check-in an item', function(){
        let newItem = {
            barcode: 00112233,
            serialNumber: 998877
        }

        let checkInData = {
            date: new Date('2018'),
            barcode: 898989
        }

        return Employee
            .findOne()
            .then(employee => {
                checkInData.employee = employee.id;
                return Item
                 .create(newItem)
            })
            .then(item => {
                checkInData.itemId = item.id;
                return chai.request(app)
                    .put(`/api/item/checkIn/${item.id}`)
                    .set("Authorization", `Bearer ${jwToken}`)
                    .send(checkInData)
            })
            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object');
                expect(res.body.checkedIn).to.have.lengthOf(1);
            })
            .catch(function (err) {
                console.log(err);
            });
    })

 it('Should check-out an item', function () {
     let newItem = {
         barcode: 00112233,
         serialNumber: 998877
     }

     let checkOutData = {
         date: new Date('2018'),
         barcode: 898989
     }

     return Employee
         .findOne()
         .then(employee => {
             checkOutData.employee = employee.id;
             return Item
                 .create(newItem)
         })
         .then(item => {
             checkOutData.itemId = item.id;
             return chai.request(app)
                 .put(`/api/item/checkOut/${item.id}`)
                 .set("Authorization", `Bearer ${jwToken}`)
                 .send(checkOutData)
         })
         .then(function (res) {
            checkResponse(res, HTTP_STATUS_CODES.OK, 'object');
            expect(res.body.checkedOut).to.have.lengthOf(1);
         })
         .catch(function (err) {
             console.log(err);
         });
 })
})

