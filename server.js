var fs = require("fs");
var wtf = require('./wtf.js');
wtf.retrieveForecast();

var cron = require('node-cron');

cron.schedule('45 1,4,7,10,13,16,19,22 * * *', function(){
  wtf.retrieveForecast();
});

var httpServer = require('http');

var http = httpServer.createServer(function(request, response) {

  if (request.url == "/") request.url = "/wtf.html";
  response.writeHead(301, {
  "Location": "https://"+request.headers.host+request.url
  });
response.end();
});
http.listen(8080);

var httpsServer = require('http-server');
var accesslog = require('access-log');
var logFD = fs.openSync("run/access.log", "a");

function logRequest(request, response)
{
  accesslog(request, response, null, function(s) {
    fs.write(logFD, s+'\n');
  });
}

var options = {
  logFn: logRequest,
  https: {
    cert: 'run/cert.pem',
    key: 'run/key.pem'
  }
};

var https = httpsServer.createServer(options);
https.listen(8443);

