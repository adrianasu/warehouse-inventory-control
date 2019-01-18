const faker = require('faker');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const { Item } = require('../app/item/item.model');
const { Employee } = require('../app/employee/employee.model');
const { Department } = require('../app/department/department.model');
const { Category } = require('../app/category/category.model');
const { Manufacturer } = require('../app/manufacturer/manufacturer.model');
const { Product } = require('../app/product/product.model');
const { User, ACCESS_ADMIN } = require('../app/user/user.model');

function getRandomFromArray( arr ) {
    return arr[ Math.floor( Math.random() * arr.length )];
}

function generateCheck( employeeIds, checkedOut ){
    const condition = ["in-use", "lost", "stolen", "broken"];
    let check = {
        employee: getRandomFromArray( employeeIds ),
        barcode: faker.random.number( 99999 ),
        date: faker.date.past(),
        authorizedBy: getRandomFromArray(employeeIds),
    }
    if( checkedOut ){
        check.condition = getRandomFromArray( condition );
    }
    return check;
}

function generateWarehouseArray(){
    let arr = [];
    for (let x = 0; x < 3; x++) {
        arr.push(faker.address.city());
    }
    return arr;
}

function generateLocation( warehouses ){
    let alphab = 'abcdefghijklmnopqrstuvwxyz';
  
    return {
        warehouse: getRandomFromArray( warehouses ),
        aisle: alphab.charAt(Math.floor(Math.random()* alphab.length)).toUpperCase(),
        shelf: faker.random.number(4),
        bin: faker.random.number(10)
    }
}

function generateOneItem( employeeIds, productIds, warehouses ) {
    let itemCondition = ['New', 'Used'];
    return {
        product: getRandomFromArray(productIds),
        barcode: faker.random.number(100000), // number between 0 and 1000
        serialNumber: faker.random.number(100000),
        registered: {
            date: faker.date.past(),
            condition: getRandomFromArray(itemCondition)
        },
        checkedOut: generateCheck( employeeIds, "out" ),
        checkedIn: generateCheck( employeeIds ),
        location: generateLocation(warehouses)
    }
}

function generateOneProduct( categoryIds, manufacturerIds ) {
    return {
        name: faker.commerce.productName(),
        category: getRandomFromArray(categoryIds),
        manufacturer: getRandomFromArray(manufacturerIds),
        model: faker.random.alphaNumeric(7),
        consummable: faker.random.boolean(),
        minimumRequired: {
            quantity: faker.random.number(5),
            units: "pieces"
        }
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
            name: faker.name.jobArea()
        });
    }
    return departments;
}

function generateEmployees( departmentIds ){
     let employees = [];
     for (let x = 0; x < 15; x++){
         employees.push({
            employeeId: faker.random.number(999999),
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName(),
            department: getRandomFromArray(departmentIds)
         });
    }
    return employees;
}

function generateOneUser(employeeId, userAccessLevel = ACCESS_ADMIN) {
    return {
        employee: employeeId,
        email: faker.internet.email(),
        password: faker.internet.password(),
        accessLevel: userAccessLevel
    };
}

function generateUsers(employeeIds){
    let users = [];
    for (let x = 0; x < 5; x++) {
        users.push(generateOneUser(employeeIds[x]));
    }
    return users;
}

function createItems(items){
    return items.forEach( item => {
        return Item.create(item)
        .catch( err => console.log(err))
    })
}

function seedItemsDb(){
    let manufacturerIds, categoryIds, departmentIds, employeeIds, userIds, productIds;
    let departments = generateDepartments();
  
         
    return Department.insertMany(departments)
        .then(_departmentIds => {
            departmentIds = _departmentIds;
          
            return Employee.insertMany(generateEmployees(departmentIds))
        })
        .then(_employeeIds => {
            employeeIds = _employeeIds;
            return User.insertMany(generateUsers(employeeIds))
        })
        .then(_userIds => {
            userIds =_userIds;
            return Manufacturer.insertMany(generateManufacturers())
        })
        .then(_manufacturerIds => {
            manufacturerIds = _manufacturerIds;
  
            return Category.insertMany(generateCategories(userIds))
        })
        .then(_categoryIds => {
            let products = [];
            categoryIds = _categoryIds;
            for (let x = 0; x < 15; x++) {
                products.push(generateOneProduct(categoryIds, manufacturerIds));
            }
         
            return Product.insertMany(products);
        })
        .then(_productIds => {
            let items = [];
            productIds = _productIds;
            let warehouses = generateWarehouseArray();
            for( let x=0; x<40; x++ ){
                items.push(generateOneItem(employeeIds, productIds, warehouses));
            }
            console.log('Generating database');
            return createItems(items);
        })
       
        .catch( err => {
            console.log("Error: ", err)
        });
}

module.exports = {
    seedItemsDb
}