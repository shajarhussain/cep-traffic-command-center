const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('CEP-06052026-103321am.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(function(error) {
    console.error(error);
});
