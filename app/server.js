const { DATABASE_URL, PORT, HTTP_STATUS_CODES, CLIENT_ORIGIN } = require('./config');
const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const passport = require('passport');

const app = express();
const cors = require('cors');
mongoose.Promise = global.Promise;

const { userRouter } = require('./user/user.router');
const { authRouter } = require('./auth/auth.router');
const { localStrategy, jwtStrategy } = require('./auth/auth.strategy');
const { itemRouter } = require('./item/item.router');
const { fieldsRouter } = require('./item/fields.router');
const { categoryRouter } = require('./category/category.router');
const { manufacturerRouter } = require('./manufacturer/manufacturer.router');

passport.use(localStrategy); // configure Passport to use our localStrategy when receiving username/password
passport.use(jwtStrategy); // configure Passport to use our jwtStrategy when receiving JWTokens

app.use(cors({ origin: CLIENT_ORIGIN }));

// middleware
app.use(morgan('common')); // allows morgan to intercept and log all HTTP requests
app.use(express.json()); // required to parse and save JSON data payload into request body
app.use(express.static('public')); // serve static files inside 'public' folder

// routers setup to redirect calls to the right router
app.use('/api/user', userRouter);
app.use('/api/auth', authRouter);
app.use('/api/item', itemRouter);
app.use('/api/searchableFields', fieldsRouter);
app.use('/api/category', categoryRouter);
app.use('/api/manufacturer', manufacturerRouter);

// handle unexpected HTTP requests
app.use('*', (req,res) => {
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ message: 'Not Found' });
});

// handle unexpected errors
app.use('*', (err, req, res, next) => {
    return res.status(err.code || 500).json({ message: err.message });
});

// to start the server when this function is called
function runServer( databaseUrl, port = PORT ){
    return new Promise((resolve, reject) => {
        mongoose.connect(
            databaseUrl,
            { useNewUrlParser: true },
            err => {
                if( err ){
                    return reject(err);
                }
                server = app.listen(port, () => {
                    console.log(`Your app is listening on port ${port}`);
                    resolve();
                })
                .on('error', err => {
                    mongoose.disconnect();
                    reject(err);
                });
            });
    });
}

function closeServer(){
    return mongoose.disconnect().then(() => {
        return new Promise((resolve, reject) => {
            console.log('Closing server');
            server.close(err => {
                if( err ){
                    return reject(err);
                }
                resolve();
            });
        });
    });
}

// to make this file a module and run the server if the script 
// is run directly (node server.js)
if( require.main === module ){
    runServer(DATABASE_URL).catch(err => console.error(err));
}


module.exports = { app, runServer, closeServer };