const faker = require('faker');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const { Item, Category, Manufacturer, Employee, Department } = require('../app/item/item.model');
const { User, ACCESS_ADMIN } = require('../app/user/user.model');

function getRandomFromArray( arr ) {
    return arr[ Math.floor( Math.random() * arr.length )];
}

function generateCheck( employeeIds, checkedOut ){
    const status = ["in-use", "lost", "stolen", "broken"];
    let check = {
        employee: getRandomFromArray( employeeIds ),
        barcode: faker.random.number( 9 ),
        date: faker.date.past()
    }
    if( checkedOut ){
        check.status = getRandomFromArray( status );
    }
    return check;
}

function generateLocation(){
    let alphab = 'abcdefghijklmnopqrstuvwxyz';
    return {
        warehouse: faker.address.city(),
        aisle: alphab.charAt(Math.floor(Math.random()* alphab.length)).toUpperCase(),
        shelf: faker.random.number(4),
        bin: faker.random.number(10)
    }
}

function generateOneItem(employeeIds, categoryIds, manufacturerIds) {
    let itemCondition = ['New', 'Used'];
    return {
        name: faker.commerce.productName(),
        barcode: faker.random.number(1000), // number between 0 and 1000
        category: getRandomFromArray(categoryIds),
        manufacturer: getRandomFromArray(manufacturerIds),
        model: faker.random.alphaNumeric(7),
        serialNumber: faker.random.number(10000),
        registered: {
            date: faker.date.past(),
            condition: getRandomFromArray(itemCondition)
        },
        consummable: faker.random.boolean(),
        minimumRequired: {
            quantity: faker.random.number(5),
            units: "pieces"
        },
        checkedOut: generateCheck( employeeIds, "out" ),
        checkedIn: generateCheck( employeeIds ),
        location: generateLocation()
    }
}

function generateManufacturers() {
    let arr = [];
    for( let x=0; x < 5; x++ ){
        arr.push({ name: faker.company.companyName() });
    }
    return arr;
}

function generateCategories(userIds) {
    let arr = [];
    for (let x = 0; x < 5; x++) {
        arr.push({
            name: faker.commerce.department(),
            addedBy: getRandomFromArray(userIds)
        });
    }
    return arr;
}

function generateDepartments(){
    let departments = [];
    for (let x = 0; x < 5; x++) {
        departments.push({
            departmentName: faker.name.jobArea()
        });
    }
    return departments;
}

function generateEmployees( departmentIds ){
     let employees = [];
     for (let x = 0; x < 5; x++){
         employees.push({
            employeeId: faker.random.number(999999),
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName(),
            department: getRandomFromArray(departmentIds)
         });
    }
    return employees;
}

function generateOneUser(userAccessLevel = ACCESS_ADMIN) {
    return {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        username: faker.internet.userName(),
        password: faker.internet.password(),
        accessLevel: userAccessLevel
    };
}

function generateUsers(){
    let users = [];
    for (let x = 0; x < 10; x++) {
        users.push(generateOneUser());
    }
    return users;
}

function seedItemsDb(){
    let manufacturerIds, categoryIds, departmentIds, employeeIds, userIds;
    let users = generateUsers();
    // let departments = generateDepartments();

  
    console.log('Generating users')
    return User
        .insertMany(users)
        .then(_userIds => {
            userIds =_userIds;
            console.log('Generating departments');
            return Department.insertMany(generateDepartments())
        })
        .then(_departmentIds => {
            departmentIds = _departmentIds;
            console.log('Generating employees');
            return Employee.insertMany(generateEmployees(departmentIds))
        })
        .then(_employeeIds => {
            employeeIds = _employeeIds;
            console.log('Generating manufacturers');
            return Manufacturer.insertMany(generateManufacturers())
        })
        .then(_manufacturerIds => {
            manufacturerIds = _manufacturerIds;
            console.log('Generating categories');
            return Category.insertMany(generateCategories(userIds))
        })
        .then(_categoryIds => {
            let items = [];
            categoryIds = _categoryIds;
            for( let x=0; x<15; x++ ){
                items.push(generateOneItem(employeeIds, categoryIds, manufacturerIds));
            }
            console.log('Generating items');
            return Item.insertMany(items);
        })
        .catch( err => {
            console.log("Error here: ", err)});
}

module.exports = {
    seedItemsDb, generateOneItem
}