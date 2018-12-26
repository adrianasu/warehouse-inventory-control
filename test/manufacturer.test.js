const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { Manufacturer } = require('../app/product/product.model');
const { TEST_DATABASE_URL, HTTP_STATUS_CODES } = require('../app/config');
const { app, runServer, closeServer } = require('../app/server');

const { generateTestUser, generateToken, seedUsersDb } = require('./fakeUser');
const { seedItemsDb } = require('./fakeData');

const expect = chai.expect;

// allow us to use chai.request() method
chai.use(chaiHttp);

let testUser, jwToken;

const manufacturerKeys = ["name"];

function checkResponse(res, statusCode, resType) {
    expect(res).to.have.status(statusCode);
    expect(res).to.be.json;
    expect(res.body).to.be.a(resType);
}

function checkObjectContent( res, manufacturerKeys, newManufacturer ){
    expect(res.body).to.include.keys(manufacturerKeys);
    manufacturerKeys.forEach( function( key ) {
        expect(res.body[key]).to.equal(newManufacturer[key]);
    });
}

function checkArrayContent( res, manufacturerKeys ){
    expect(res.body).to.have.lengthOf.at.least(1);
    expect(res.body[0]).to.include.keys(manufacturerKeys);
}

function tearDownDb(){
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}
 
describe( 'Manufacturer API resource tests', function(){

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

    it( 'Should create a new manufacturer', function(){
       let newManufacturer = {
            name: "newManufacturer"
        };
       
        return chai.request( app )
            .post('/api/manufacturer')
            .set('Authorization', `Bearer ${ jwToken }`)
            .send( newManufacturer )
            .then( function( res ){
                checkResponse( res, HTTP_STATUS_CODES.CREATED, 'object' );
                checkObjectContent( res, manufacturerKeys, newManufacturer );
            })
            .catch( function( err ){
                console.log( err );
            });
    });

    it("Should not create a new manufacturer bc already exists", function(){
        let newManufacturer = {};
        
        return Manufacturer 
        .findOne()
        .then( manufacturer => {
            newManufacturer.name = manufacturer.name;
        
            return chai.request( app )
                .post('/api/manufacturer')
                .set('Authorization', `Bearer ${ jwToken }`)
                .send(newManufacturer)
                .then( function( res ){
                    checkResponse( res, HTTP_STATUS_CODES.BAD_REQUEST, 'object' );
                    expect( res.body ).to.include({message: `A manufacturer ${newManufacturer.name} already exists.`});
                })
        })
        .catch( function( err ){
             console.log( err )
        });
    });

    it('Should return all manufacturers', function(){
        return chai.request( app )
            .get('/api/manufacturer')
            .then( function( res ){
                checkResponse( res, HTTP_STATUS_CODES.OK, 'array' );
                checkArrayContent( res, manufacturerKeys );
            })
            .catch( function( err ){
                console.log( err );
            })
    });

    it('Should return a manufacturer by id', function(){
        
        return Manufacturer
            .findOne()
            .then(function (foundManufacturer) {
                return chai.request(app)
                    .get(`/api/manufacturer/${foundManufacturer._id}`)
                    .set("Authorization", `Bearer ${jwToken}`)
                })
                .then(function(res) {
                  
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object')
                expect(res.body).to.include.keys("name");
            })
            .catch(function (err) {
                console.log(err);
            })
    })

    

    it('Should update manufacturer by manufacturerId', function () {

        let foundManufacturer, updateManufacturer;
        updateManufacturer = {
            name: "Update manufacturer"
        }

        return Manufacturer
            .findOne()
            .then(function(_foundManufacturer) {
                foundManufacturer = _foundManufacturer;
                updateManufacturer.id = foundManufacturer.id;
                return chai.request(app)
                    .put(`/api/manufacturer/${updateManufacturer.id}`)
                    .set("Authorization", `Bearer ${jwToken}`)
                    .send(updateManufacturer)
            })
            .then(function (res) {
                checkResponse(res, HTTP_STATUS_CODES.OK, 'object')
                checkObjectContent(res, ["name"], updateManufacturer);
            })
            .catch(function (err) {
                console.log(err);
            });
    });

    it('Should delete manufacturer by manufacturerId', function () {
      
        return Manufacturer
            .findOne()
            .then(function (manufacturer) {

                return chai.request(app)
                .delete(`/api/manufacturer/${manufacturer.id}`)
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