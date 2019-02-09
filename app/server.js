const { DATABASE_URL, PORT, HTTP_STATUS_CODES, CLIENT_ORIGIN } = require('./config');
const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const passport = require('passport');

const app = express();
const cors = require('cors');
mongoose.Promise = global.Promise;

const { authRouter } = require('./auth/auth.router');
const { categoryRouter } = require('./category/category.router');
const { departmentRouter } = require('./department/department.router');
const { employeeRouter } = require('./employee/employee.router');
const { fieldsRouter } = require('./fields/fields.router');
const { itemRouter } = require('./item/item.router');
const { localStrategy, jwtStrategy } = require('./auth/auth.strategy');
const { manufacturerRouter } = require('./manufacturer/manufacturer.router');
const { myAccountRouter } = require('./my-account/my-account.router');
const { productRouter } = require('./product/product.router');
const { userRouter } = require('./user/user.router');

app.use(cors({ origin: CLIENT_ORIGIN }));

// middleware
app.use(morgan('common')); // allows morgan to intercept and log all HTTP requests
app.use(express.json()); // required to parse and save JSON data payload into request body
app.use(express.static('public')); // serve static files inside 'public' folder

passport.use(localStrategy); // configure Passport to use our localStrategy when receiving username/password
passport.use(jwtStrategy); // configure Passport to use our jwtStrategy when receiving JWTokens

// routers setup to redirect calls to the right router
app.use('/api/auth', authRouter);
app.use('/api/category', categoryRouter);
app.use('/api/department', departmentRouter);
app.use('/api/employee', employeeRouter);
app.use('/api/item', itemRouter);
app.use('/api/manufacturer', manufacturerRouter);
app.use('/api/my-account', myAccountRouter);
app.use('/api/product', productRouter);
app.use('/api/searchableFields', fieldsRouter);
app.use('/api/user', userRouter);

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
                    console.log(`Warehouse App is running on port ${port}`);
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
// is run directly (node server.js).
// 'module' is this file. If the file required is
// this file, run server.
if( require.main === module ){
    runServer(DATABASE_URL).catch(err => console.error(err));
}


module.exports = { app, runServer, closeServer };