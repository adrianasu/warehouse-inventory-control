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

    // it('Advanced search should find an item that contains all the values in the query ', function () {
    //     let searchQuery = {
    //                         name: "Zapato",
    //                         model: "ABC123",
    //                         barcode: 123456,
    //                         serialNumber: 456789,
    //                         consummable: true
    //                         };

    //     return Item
    //         .create(searchQuery)
    //         .then(ids => {
    //         return chai.request(app)
    //             .get(`/api/item/advancedSearch?name=${searchQuery.name}&model=${searchQuery.model}&barcode=${searchQuery.barcode}`)

    //         })
    //         .then(function (res) {
    //             checkResponse(res, HTTP_STATUS_CODES.OK, 'object');
    //             checkObjectContent(res, itemKeys, searchQuery);
    //         })
    //         .catch(function (err) {
    //             console.log(err);
    //         });
    // })

})

