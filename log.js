function logMessage(message){
  let date_ob = new Date()
  let currentDate = date_ob.toLocaleDateString('en-US', { 
    year:"numeric", month:"numeric", day:"numeric"
  })
  let currentTime = date_ob.toLocaleTimeString('en-US', { hour12: false })+" - "
  console.log(currentDate + " " + currentTime + message)
}

exports.logMessage = logMessage