const fs = require('fs');
const main = require('./index.js');
const log = require('./log.js')

//writes object to file in JSON String format
function writeJsonFile(filename, obj){
  fs.writeFile(filename, JSON.stringify(obj), (err) => {
    if (err) throw err;
    log.logMessage('Wrote to file ' + filename + ": " + JSON.stringify(obj))
  });
}

//Checks if settings.txt exists
function initialize(){
  try {
    //if file exists
    if (fs.existsSync('./settings/settings.json')) {
      fs.readFile('./settings/settings.json', 'utf8', function(err, data){
        // Display the file content
        const storedSettings = JSON.parse(data)
        pumpDuration = parseInt(storedSettings.pumpDuration)
        pumpInterval = parseInt(storedSettings.pumpInterval)
        mode = parseInt(storedSettings.mode)
        soilMoistureTarget = parseFloat(storedSettings.soilMoistureTarget)
        main.setSettings(pumpDuration, pumpInterval, mode, soilMoistureTarget)
        log.logMessage("Set stored settings " + data);
    });
    //else file doesn't exist, write default values to file
    } else {
      log.logMessage("Settings file not found, Creating new file")
      let obj = new Object()
      obj.pumpDuration = main.pumpDuration
      obj.pumpInterval = main.pumpInterval
      obj.mode = main.mode
      obj.soilMoistureTarget = main.soilMoistureTarget
      writeJsonFile('./settings/settings.json', obj)
    }
  } catch(err) {
    console.error(err)
  }
}

exports.initialize = initialize
exports.writeJsonFile = writeJsonFile