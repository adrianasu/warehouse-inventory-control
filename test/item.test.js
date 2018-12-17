const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { Item } = require('../app/item/item.model');
const { TEST_DATABASE_URL, HTTP_STATUS_CODES } = require('../app/config');
const { app, runServer, closeServer } = require('../app/server');

const { generateTestUser, generateToken, seedUsersDb } = require('./fakeUser');
const { seedItemsDb, generateOneItem } = require('./fakeData');

const expect = chai.expect;

// allow us to use chai.request() method
chai.use(chaiHttp);

let testUser, jwToken;
const itemKeys = ["name", "barcode", "model", "serialNumber", "consummable"];

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
    expect(res.body[0]).to.not.include.keys('password');
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
                console.log("TOKEN ITEMTEST ",jwToken);
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
        name: "Hammer",
        barcode: 123456,
        model: "ABC123",
        serialNumber: 567890,
        consummable: false,
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
})

