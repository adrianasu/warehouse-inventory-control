const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { Product, Category, Manufacturer } = require('../app/product/product.model');
const { TEST_DATABASE_URL, HTTP_STATUS_CODES } = require('../app/config');
const { app, runServer, closeServer } = require('../app/server');

const { generateTestUser, generateToken } = require('./fakeUser');
const { seedItemsDb } = require('./fakeData');

const expect = chai.expect;

// allow us to use chai.request() method
chai.use(chaiHttp);

let testUser, jwToken;

const productKeys = ["name", "model", "consummable"];

function checkResponse(res, statusCode, resType) {
    expect(res).to.have.status(statusCode);
    expect(res).to.be.json;
    expect(res.body).to.be.a(resType);
}

function checkObjectContent( res, productKeys, newProduct ){
    expect(res.body).to.include.keys(productKeys);
    productKeys.forEach( function( key ) {
        expect(res.body[key]).to.equal(newProduct[key]);
    });
}

function checkArrayContent( res, productKeys ){
    expect(res.body).to.have.lengthOf.at.least(1);
    expect(res.body[0]).to.include.keys(productKeys);
}

function tearDownDb(){
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}
 
describe( 'Product API resource tests', function(){

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

    it( 'Should create a new product', function(){
       let newProduct = {
            name: "newProduct",
            model: "ABC123",
        };

            return chai.request( app )
                .post('/api/product')
                .set('Authorization', `Bearer ${ jwToken }`)
                .send( newProduct )
            .then( function( res ){
                checkResponse( res, HTTP_STATUS_CODES.CREATED, 'object' );
                checkObjectContent( res, ["name", "model"], newProduct );
            })
            .catch( function( err ){
                console.log( err );
            });
    });

    it("Should not create a new product bc already exists", function(){
        let newProduct = {};
        
        return Product 
        .findOne()
        .then( product => {
            newProduct.name = product.name;
            return chai.request( app )
                .post('/api/product')
                .set('Authorization', `Bearer ${ jwToken }`)
                .send(newProduct)
                .then( function( res ){
                    checkResponse( res, HTTP_STATUS_CODES.BAD_REQUEST, 'object' );
                    expect( res.body ).to.include({message: `A product ${newProduct.name} already exists.`});
                })
        })
        .catch( function( err ){
             console.log( err )
        });
    });

    it('Should return all products', function(){
        return chai.request( app )
            .get('/api/product')
            .then( function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'array' );
                checkArrayContent( res, productKeys );
            })
            .catch( function( err ){
                console.log( err );
            })
    });

    it('Should return a product by id', function(){
        
        return Product
            .findOne()
            .then(function (foundProduct) {
                return chai.request(app)
                    .get(`/api/product/${foundProduct.id}`)
                    .set("Authorization", `Bearer ${jwToken}`)
                })
                .then(function(res) {
                  
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object')
                expect(res.body).to.include.keys("name", "manufacturer");
            })
            .catch(function (err) {
                console.log(err);
            })
    })

    

    it('Should update product by productId', function () {
        let updateProduct = { name: "Crazy Name" };
        return Product
            .findOne()
            .then(function(foundProduct) {
                updateProduct.id = foundProduct.id;
                return chai.request(app)
                    .put(`/api/product/${updateProduct.id}`)
                    .set("Authorization", `Bearer ${jwToken}`)
                    .send(updateProduct)
            })
            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object')
                checkObjectContent(res, ["name"], updateProduct);
            })
            .catch(function (err) {
                console.log(err);
            });
    });

    it('Should delete product by productId', function () {
      
        return Product
            .findOne()
            .then(function (product) {
                return chai.request(app)
                .delete(`/api/product/${product.id}`)
                .set("Authorization", `Bearer ${jwToken}`)
            })
            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object');
                let responseKeys = ["deleted", "OK"];
                expect(res.body).to.include.keys(responseKeys);
            })
            .catch(function( err ) {
                console.log( err );
            });
    });

    

})