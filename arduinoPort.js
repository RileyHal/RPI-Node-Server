const { SerialPort, ReadlineParser } = require('serialport')
const main = require('./index.js');
const log = require('./log.js')

const serPort = new SerialPort({ path:'/dev/ttyACM0', baudRate:9600 })
const parser = new ReadlineParser()
serPort.pipe(parser)

serPort.on('open', ()=>{log.logMessage('Port opened')})

parser.on('data', (data)=>{
  try{
    var receivedData = JSON.parse(String(data))
    main.setArduinoData(receivedData)
  }
  catch(e){
    log.logMessage("Failed to parse serial data")
  }
})

function sendDataJson(mode, duration, interval, soilMoistureTarget){
  let obj = new Object()
  obj.mode = mode
  obj.duration = duration
  obj.interval = interval
  obj.soilMoistureTarget = parseInt((1 - soilMoistureTarget)*(main.soilOutWaterReading - main.soilInWaterReading) + main.soilInWaterReading)
  //log.logMessage("Moisture Target " + obj.soilMoistureTarget)
  serPort.write(JSON.stringify(obj))
}

exports.sendDataJson = sendDataJson