var dirMap = {"N":  0.0, "NNE": 22.5, "NE": 45.0, "ENE": 67.5, "E": 90.0, "ESE":112.5, "SE":135.0, "SSE":157.5,
              "S":180.0, "SSW":202.5, "SW":225.0, "WSW":247.5, "W":270.0, "WNW":292.5, "NW":315.0, "NNW":337.5};

var raspCOORDs =
{
  VIC:
  {
    tlat: -32.24, tlon: 140.60, ty: 183, tx: 92,
    blat: -38.58, blon: 150.02, by: 880, bx: 930
  },
  NSW:
  {
    tlat: -32.24, tlon: 140.60, ty: 183, tx: 92,
    blat: -38.58, blon: 150.02, by: 880, bx: 930
  },
  QLD:
  {
    tlat: -32.24, tlon: 140.60, ty: 183, tx: 92,
    blat: -38.58, blon: 150.02, by: 880, bx: 930
  }
}

var fs = require("fs");
var path = require("path");
var jsdom = require("jsdom");
var request = require("request");
var request = require("request");
var jimp = require('jimp');

var jquery = fs.readFileSync("jquery.js", "utf-8");

var title;
var sites;
var times = [];
var raspTimes;
var raspImages;

var adate;
var auth;

var cbCount = 0;
var raspCBCount = 0;

function formatYYYYMMDD(date)
{
  return new Date(date - date.getTimezoneOffset()*60*1000).toISOString().substr(0, 10);
  //return date.getFullYear()+"-"+(date.getMonth()+1).toString().padStart(2, '0')+"-"+date.getDate().toString().padStart(2, '0');
}

function saveForecast()
{
  var d = new Date();
  var filename=new Date(d - d.getTimezoneOffset()*60*1000).toISOString().substr(0, 13)+".json";
  var data = {"title":title, "times":times, "rasptimes":raspTimes, "sites":sites};
  var run = "public/run/";
  try
  {
    fs.unlinkSync(run+filename);
  }
  catch (err) {}
  fs.writeFileSync(run+filename, JSON.stringify(data));
  try
   {
    fs.unlinkSync(run+"current.json");
  }
  catch (err) {}
  fs.symlinkSync(filename, run+"current.json");

  var history = [];
  var files = fs.readdirSync(run);
  for(var i=0; i<files.length; ++i)
  {
    if(files[i].endsWith(".json"))
      history.push(files[i].substr(0, files[i].length-5));
  }

  history.sort();
  history.reverse();

  var histFD = fs.openSync("public/wtf-history.html", "w");

  var histStart = fs.readFileSync("history.html.start");
  fs.writeSync(histFD, histStart.toString());

  for(var i=0; i<history.length; ++i)
  {
    fs.writeSync(histFD, '<a href="#" onclick="showDate(\''+history[i]+'\')">'+history[i]+'</a><p>\n');
  }
  fs.writeSync(histFD, "</font></body></html>");

  fs.closeSync(histFD);

  console.log(new Date().toString()+" Forecast written to "+filename);

  // Format with:
  // python -m json.tool data-example.json >data-example-formatted.json
  // fs.writeFileSync("data-example.json", JSON.stringify(sites));
}

function processForecast()
{
  for(s in sites)
  {
    var site = sites[s];

    var minDir =   0.0;
    var maxDir = 360.0;

    if(site.minDir) minDir = dirMap[site.minDir];
    if(site.maxDir) maxDir = dirMap[site.maxDir];
    var minSpeed = site.minSpeed;
    var maxSpeed = site.maxSpeed;
    var minPGSpeed = site.minPGSpeed;
    var maxPGSpeed = site.maxPGSpeed;

    for(e in site.forecast)
    {
      var entry = site.forecast[e];
        
      for(t in times)
      {
        var time = times[t];

        var cond = entry[time];
          
        var dirStr = cond.dir;
        var kts = cond.kts;

        var dir = dirMap[dirStr];

        if(minDir > maxDir)
        {
          if(dir <= maxDir || dir >= minDir)
            cond.colour = cond.PGColour = "Yellow";
        }
        else if (minDir <= dir && dir <= maxDir)
          cond.colour = cond.PGColour = "Yellow";

        if(cond.colour)
        {
          if(kts >= minSpeed)
            cond.colour = "LightGreen";

          if(kts > maxSpeed)
            cond.colour = "Orange";

          if(kts >= minPGSpeed)
            cond.PGColour = "LightGreen";

          if(kts > maxPGSpeed)
            cond.PGColour = "Orange";
        }
      }
    }

    site.rasp = [];

    for(day=0; day<1; ++day)
    {
      var cond = {};
      var date = new Date();
      date.setDate(date.getDate() + day);
      cond.date = formatYYYYMMDD(date);
      site.rasp.push(cond);

      for(t in raspTimes)
      {
        var time = raspTimes[t];

        var coords = raspCOORDs[site.state];

        var dlat = coords.blat - coords.tlat;
        var dy = coords.by - coords.ty;
        var step = dy/dlat;

        var y = coords.ty + ((site.lat - coords.tlat) * step);

        var dlon = coords.blon - coords.tlon;
        var dx = coords.bx - coords.tx;
        step = dx/dlon;

        var x = coords.tx + ((site.lon - coords.tlon) * step);

        var red   = 0;
        var green = 0;
        var blue  = 0;

        raspImages[site.state][day][time].scan(x+15,y-15,10,10, function(x, y, idx)
        {
          var r = this.bitmap.data[idx + 0];
          var g = this.bitmap.data[idx + 1];
          var b = this.bitmap.data[idx + 2];
          if(r ==   0 && g ==   0 && b ==   0) return; // Gridline
          if(r == 255 && g == 255 && b == 255) return; // Text

          red   += r;
          green += g;
          blue  += b;
          //this.bitmap.data[idx + 0] = 255;
          //this.bitmap.data[idx + 1] = 255;
          //this.bitmap.data[idx + 2] = 255;
        });

        cond[time] = "#"+
                                Math.round(red/100).toString(16).padStart(2, '0')+
                                Math.round(green/100).toString(16).padStart(2, '0')+
                                Math.round(blue/100).toString(16).padStart(2, '0');
      }
    }
  }
}

function raspImageCB(state, day, time, image)
{
  console.log(state, day, time, image.bitmap.width, image.bitmap.height);

  if(raspImages[state][day] === undefined)
    raspImages[state][day] = {};

  raspImages[state][day][time] = image;

  --raspCBCount;

  if(raspCBCount == 0)
  {
    console.log("RASP DONE");

    processForecast();

    saveForecast();
  }
}

function mkRASPImageCB(state, day, time)
{
  var d = "";
  if(day>0) d = "+"+day;

  ++raspCBCount;

  jimp.read("http://glidingforecast.on.net/RASP/"+state+d+"/FCST/wstar.curr"+d+"."+time+"00lst.d2.png", function(err, image)
  {
    if (err) throw err;
    raspImageCB(state, day, time, image);
  });
}

function getRASPImages()
{
  raspImages = [];

  if(!raspTimes)
  {
    raspTimes = [];
    for(t=8; t<=19; ++t)
    {
      var time = t.toString().padStart(2, "0");
      raspTimes.push(time);
    }
  }

  for(s in sites)
  {
    var state = sites[s].state;

    if(raspImages[state] === undefined)
    {
      raspImages[state] = {};

      for(day=0; day<1; ++day)
      {
        for(t in raspTimes)
        {
          var time = raspTimes[t];

          mkRASPImageCB(state, day, time);
        }
      }
    }
  }
}

function forecast(site, entry, window)
{
  var time = window.$("th");
  var dir = window.$("td[class^='wind_dir']");
  var kts = window.$("td[data-kts]");

  var offset=time.length-1-kts.length;

  for (i = 0; i<time.length-1; ++i)
  {
    if (times.length < i+1)
    {
      var s = time[i+1].innerHTML;
      var t = parseFloat(s.substring(0, s.length-3));

      if(s.substring(s.length-2) === "PM")
        t += 12.0;

      times.push(t.toString().padStart(2, "0"));
    }

    var cond = times[i];

    if(i-offset >=0)
      entry[cond] = {"dir":dir[i-offset].innerHTML, "kts":kts[i-offset].attributes["data-kts"].nodeValue};
    else
      entry[cond] = {"dir":"", "kts":""};
  }

  // When all the forecast callbacks have returned we process all the data.
  --cbCount;

  if (cbCount == 0)
  {
    getRASPImages();
  }
}

function forecastCB(site, entry, body)
{
  try
  {
    jsdom.env
    ({
      html: body,
      src: [jquery],
      done: function (err, window)
      {
        forecast(site, entry, window);
      }
    });
  }
  catch (err)
  {
    --cbCount;
    console.log("ERROR forecastCB:"+err);
  }
}

/*
To get the wind forcaset for each day we need a query of the form:
http://www.bom.gov.au/australia/meteye/forecast.php?&lat=-38.46&lon=144.06&date=2016-06-05
This produces forecast-example.html

Note that we need to do this call in sub-function to get the closure to work.
*/

function mkForecastCB(site, entry)
{
  // We count the number of forecast callback so that we know when we've got all the data.
  ++cbCount;

  request.post(
  {
    url: "http://www.bom.gov.au/australia/meteye/forecast.php?&lat="+site.lat+"&lon="+site.lon+"&date="+entry.date,
    headers: {'User-Agent': "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.81 Safari/537.36"},
    body: '{"adate":"'+adate+'","auth":"'+auth+'"}'
  },
  function (err, response, body)
  {
    forecastCB(site, entry, body);
  });
}

function imageCB(uri, filename)
{
  if(!fs.existsSync(filename))
  {
    request(
      {
        url: uri,
        headers: {'User-Agent': "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.81 Safari/537.36"},
      }).pipe(fs.createWriteStream(filename));
  }
}

function mkImageCB(uri, filename)
{
  // Sometimes the downloads fail and create a zero length image files.
  if(fs.existsSync(filename))
  {
    var s = fs.statSync(filename);

    if(s.size == 0)
      fs.unlinkSync(filename);
  }

  if(!fs.existsSync(filename))
  {
    request.head(uri,
                function(err, res, body)
                {
                  imageCB(uri, filename);
                });
  }
}

function overview(site, window)
{
  var date = window.$("th[datetime]");
  var img = window.$("img");

  for (i = 0; i<date.length; ++i)
  {
    // Sometimes the image links are missing. This may result in a wrong forcast
    // as we assume there are the same number of images as dates. So if it's not
    // the last image that's missing the forcast images will be a day out, although
    // it's most likely to be the last one as this will be where they haven't got
    // a forecast.

    var imgSrc = null;
    var imgTitle = null;
    var filename = null;
    if(img[i])
    {
      imgSrc = img[i].attributes["src"].nodeValue;
      imgTitle = img[i].attributes["alt"].nodeValue;

      var uri = "http://www.bom.gov.au"+imgSrc;
      imgFilename = "run/images/"+path.basename(imgSrc);
      filename = "public/"+imgFilename;
      mkImageCB(uri, filename);
    }

    var entry = {"date": date[i].attributes["datetime"].nodeValue, "img": imgFilename, "imgTitle": imgTitle, "conditions": []};
    site.forecast.push(entry);

    mkForecastCB(site, entry);
  }
}

function overviewCB(site, body)
{
  jsdom.env
  ({
    html: body,
    src: [jquery],
    done: function (err, window)
    {
      overview(site, window);
    }
  });
}

/*
For each site we retrieve the weeks overview with query of form:
http://www.bom.gov.au/australia/meteye/forecast.php?&lat=-38.46&lon=144.06
This produces overview-example.html

Note that we need to do this call in sub-function to get the closure to work.
*/
function mkOverviewCB(site)
{
  request.post(
    {
      url: "http://www.bom.gov.au/australia/meteye/forecast.php?",
      headers: {'User-Agent': "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.81 Safari/537.36"},
      form: {lat:site.lat, lon:site.lon, adate:adate, auth:auth}
    },
    function (err, response, body)
    {
      try
      {
        overviewCB(site, body);
      }
      catch (err)
      {
        console.log("ERROR mkOverviewCB:"+err);
      }
    });
}

/*
Authentication information is returned in the meta information.

This must be sent in the body of for all subsequent POST queries the form:
{"adate":"1465130131","auth":"dzJUeHpvaTNSeXlMUWtoZnhFSTJUNlZ5djhoa1B0dUt5a2VrRDVmVUg0bUZTOGRpUU9EUzI1MGQrcXdLd3lBUlFyR1pDMlhTRW5PUXFkbTlra0p2UFI="}
*/

function authCB(err, window)
{
  try
  {
    adate = window.$("meta[name='DC.Date']")[0].content;
    auth  = window.$("meta[name='BoM.Token']")[0].content;

    for(s in sites)
    {
      var site = sites[s];
      site.forecast = [];

      mkOverviewCB(site);
    }
  }
  catch (err)
  {
    console.log("ERROR authCB:"+err);
  }
}

/*
We hit the main site once first to get the authentication information for subsiquent queries.
*/

function retrieveForecast()
{
  var data = JSON.parse(fs.readFileSync('run/sites.json'));

  title = "Where To Fly";
  if(data.title) title = data.title;

  sites = data.sites;

  jsdom.env
  ({
    url: "http://www.bom.gov.au/australia/meteye/",
    src: [jquery],
    done: authCB
  });
}

module.exports.retrieveForecast = retrieveForecast;

