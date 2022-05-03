var https = require('https')
const fs = require('fs')
const path = require('path')
const express = require('express')
const router = express.Router()
const bodyParser = require('body-parser')
const fileService = require('./fileServices.js');
const arduinoService = require('./arduinoPort.js')
const log = require('./log.js')
const cors = require('cors')
let port = 3000
const app = express()

let db
let counter = 0;

var admin = require("firebase-admin");
var serviceAccount = require("./https/firebaseKey.json");

app.use(cors({
    origin: '*'
}));

app.use(router)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let soilMoisture = 0
let isEmpty = true
let lightLevel = 0
let pumpActive = false
let temperature = 0
let humidity = 0;

//Default values if settings.json not found
let defaultPumpDuration = 5
let defaultPumpInterval = 500
let defaultSoilMoistureTarget = .23
const soilInWaterReading = 213
const soilOutWaterReading = 435

//0=off, 1=auto, 2= timer
let defaultMode = 0

let pumpDuration, pumpInterval, mode, soilMoistureTarget

function successGetJSON(data){
  let obj = new Object()
  obj.status = 'ok'
  obj.data = data
  return obj
}

function JSONMessage(status, message){
  let obj = new Object()
  obj.status = status
  obj.message = message
  return obj
}

//file service callback if stored values are found
function setSettings(duration,interval,rmode,moistureTarget){
  pumpDuration = duration
  pumpInterval = interval
  mode = rmode
  soilMoistureTarget = moistureTarget
}

async function sendToDB(obj){
  try {
    const result = await db.collection('RaspberryData').add(obj)
  } catch (e){
    log.logMessage(e)
  }
}

//this is a callback function from the arduino to update main data
function setArduinoData(data){
  soilMoisture = data.Moisture
  lightLevel = data.Light / 1024

  if(data.isWater == 0){
    isEmpty = true
  } else {
    isEmpty = false
  }
  
  if(data.pumpActive == 0){
    pumpActive = false
  } else {
    pumpActive = true
  }
  temperature = data.temperature
  humidity = data.Humidity

  //send this data to firestore every 10 mins
  if(counter >= 600){
    let tempObj = new Object()
    tempObj.soilMoisture = parseFloat((-((soilMoisture - soilInWaterReading)/(soilOutWaterReading - soilInWaterReading)) + 1).toFixed(4))
    tempObj.lightLevel = parseFloat(lightLevel.toFixed(4))
    tempObj.humidity = humidity/100
    tempObj.temperature = temperature
    tempObj.DateTime = new Date()
    sendToDB(tempObj)
    counter = 0
  }
  
  counter++
}

router.get('/', (req,res,next)=>{
  res.send("Raspberry Pi Server")
  log.logMessage("Attempted connection to " + req.path)
})

router.get('/v1/data', (req,res,next)=>{
  log.logMessage("GET Request Successful")
  res.json(successGetJSON({
    'soilMoisture': parseFloat((-((soilMoisture - soilInWaterReading)/(soilOutWaterReading - soilInWaterReading)) + 1).toFixed(4)),
    'humidity':humidity/100,
    'isEmpty': isEmpty,
    'lightLevel': parseFloat(lightLevel.toFixed(4)),
    'pumpActive': pumpActive,
    'temperature': parseFloat(temperature.toFixed(2)),
    'pumpDuration': pumpDuration,
    'pumpInterval': pumpInterval,
    'soilMoistureTarget' : parseFloat(soilMoistureTarget.toFixed(4)),
    'mode': mode
  }))
})

router.post('/v1/set', (req,res,next)=>{
  let tempPumpDuration = parseInt(req.query.pumpDuration)
  let tempPumpInterval = parseInt(req.query.pumpInterval)
  let tempMode = parseInt(req.query.mode)
  let tempTargetMoisture = parseFloat(req.query.soilMoistureTarget)
  
  try{
    if(!req.query.pumpDuration || !req.query.pumpInterval || !req.query.mode || !req.query.soilMoistureTarget){
      log.logMessage("Received Invalid Post Request, Invalid parameter names")
      res.status = 400
      res.json(JSONMessage('error','Invalid query parameter name(s)'))
    } 
  
    else if(isNaN(tempPumpDuration) || isNaN(tempPumpInterval) || isNaN(tempMode)){
      log.logMessage("Received Invalid Post Request, paramater(s) NaN")
      res.status = 400
      res.json(JSONMessage('error', 'pumpDuration, pumpInterval or mode is NaN'))
    } 
  
    else if (tempMode < 0 || tempMode > 2 || 
      tempPumpDuration < 1 || tempPumpDuration > 60 || 
      tempPumpInterval < 5 || tempPumpInterval > 2628288 ||
      tempTargetMoisture > 1 || tempTargetMoisture < 0){
        log.logMessage("Received Invalid Post Request, Invalid data range")
        res.status = 400
        res.json(JSONMessage('error', 'pumpDuration(1-60), pumpInterval(5-2628288), mode(0-2), or soilMoistureTarget(0-1) is out of range'))
    } 
  
    //If everything is validated write to settings file and set new values
    else {
      let obj = new Object()
      obj.pumpDuration = tempPumpDuration
      obj.pumpInterval = tempPumpInterval
      obj.mode = tempMode
      obj.soilMoistureTarget = tempTargetMoisture
      fileService.writeJsonFile('./settings/settings.json', obj)
  
      pumpInterval = tempPumpInterval
      pumpDuration = tempPumpDuration
      mode = tempMode
      soilMoistureTarget = tempTargetMoisture
  
      arduinoService.sendDataJson(mode, pumpDuration, pumpInterval, soilMoistureTarget)
      log.logMessage("Sent set data to arduino")
  
      res.status = 200
      res.json(JSONMessage('ok', "Set pumpDuration to "+pumpDuration+", pumpInterval to "+pumpInterval+", soilMoistureTarget to "+soilMoistureTarget+", and mode to "+mode))
    }
  } catch(err) {
    res.status = 400
    res.json(JSONMessage('Error', err.message))
  }
  
})

const options = {
  key: fs.readFileSync(path.join('./https/key.pem')),
  cert: fs.readFileSync(path.join('./https/cert.pem'))
}

https.createServer(options, app).listen(port, () => {
  log.logMessage("Server initiated, Listening on port "+port)
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();

  //check to see if settings.txt exists, if not create on with default values
  fileService.initialize();
  //set stored settings to the arduino
  setTimeout(()=>{
    log.logMessage("Sent set data to arduino")
    arduinoService.sendDataJson(mode, pumpDuration, pumpInterval, soilMoistureTarget)
  }, 2000)
})

//export these values for fileServices to use for default values
exports.pumpDuration = defaultPumpDuration
exports.pumpInterval = defaultPumpInterval
exports.mode = defaultMode
exports.soilMoistureTarget = defaultSoilMoistureTarget
exports.soilOutWaterReading = soilOutWaterReading
exports.soilInWaterReading = soilInWaterReading


//this export is a callback for arduino set data
exports.setArduinoData = setArduinoData
exports.setSettings = setSettings