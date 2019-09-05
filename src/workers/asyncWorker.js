import { TransactionEntry } from "../mockData/interfaces";
import { onNewTransaction } from "./onNewTransaction";

var workerpool = require('workerpool');

// an async function returning a promise
function asyncAdd(a, b) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve(a + b);
        }, 10000);
    });
}

// an async function returning a promise
function asyncMultiply(a, b) {
    return new Promise(function (resolve, reject) {
        setTimeout(function () {
            resolve(a * b);
        }, 1000);
    });
}

// create a worker and register public functions
workerpool.worker({
    asyncAdd: asyncAdd,
    asyncMultiply: asyncMultiply,
});
