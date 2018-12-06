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

const accessLevel = [ACCESS_BASIC, ACCESS_OVERVIEW, ACCESS_PUBLIC, ACCESS_ADMIN];

function generateTestUser( userAccessLevel = ACCESS_ADMIN ){
    return{
        name: `${faker.name.firstName()} ${faker.name.lastName()}`,
        email: faker.internet.email(),
        username: faker.internet.userName(),
        password: faker.internet.password(),
        accessLevel: userAccessLevel
    };
}

function seedTestUser( testUser, hashedPassword ){
    return User
    .create({
        name: testUser.name,
        email: testUser.email,
        username: testUser.username,
        password: hashedPassword,
        accessLevel: testUser.accessLevel
    });
}

function signJwToken( user ){
    return jsonwebtoken.sign({
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
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
            testUser.id = createdUser.id;
            return signJwToken( testUser )
        })
        .catch( err => {
            console.error(err);
        });
}

module.exports = { generateTestUser, generateToken };