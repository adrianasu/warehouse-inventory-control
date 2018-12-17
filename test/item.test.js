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

function insertItems( searchTerm ){
    let newItems = [{name: searchTerm, 
                    barcode: 456,
                    model: "abc",
                    serialNumber: 1230,
                    consummable: true}, 
                 {model: searchTerm,
                    name: "John",
                    barcode: 123,
                    serialNumber: 789,
                    consummable: false                
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

    it("Should not create a new item bc barcode already exists", function(){
        let newItem = {
            name: "Hammer",
            model: "ABC123"
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
        let searchTerm = "Zapato";
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
})

