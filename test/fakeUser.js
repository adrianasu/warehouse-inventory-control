const faker = require( 'faker' );
const jsonwebtoken = require( 'jsonwebtoken' );
const mongoose = require( 'mongoose' );
mongoose.Promise = global.Promise;

const { JWT_SECRET, JWT_EXPIRY } = require( '../app/config' );

const {
    User,
    ACCESS_BASIC,
    ACCESS_OVERVIEW,
    ACCESS_PUBLIC,
    ACCESS_ADMIN
} = require('../app/user/user.model');

function generateTestUser( userAccessLevel = ACCESS_ADMIN ){
    return{
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        username: faker.internet.userName(),
        password: faker.internet.password(),
        accessLevel: userAccessLevel
    };
}

function seedTestUser( testUser, hashedPassword ){
 
    return User
    .create({
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        username: testUser.username,
        password: hashedPassword,
        accessLevel: testUser.accessLevel
    });
}

function generateUsers(){
    let users = [];
    for (let x = 0; x < 10; x++) {
        users.push(generateTestUser());
    }
    return users;
}


function signJwToken( user ){
 
    return jsonwebtoken.sign({
        user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            accessLevel: user.accessLevel
        }
    },
    JWT_SECRET,
    {
        algorithm: 'HS256',
        expiresIn: JWT_EXPIRY,
        subject: user.username
    }
    );
}
 
function generateToken( testUser ){
    return User.hashPassword( testUser.password )
        .then( hashedPassword => {
            return seedTestUser( testUser, hashedPassword )
        })
        .then( createdUser => {
            testUser.id = createdUser._id;
            return signJwToken( testUser );      
        })
        .catch( err => {
            console.error(err);
        });
}

module.exports = { generateTestUser, generateToken };