var dirMap = {"N":  0.0, "NNE": 22.5, "NE": 45.0, "ENE": 67.5, "E": 90.0, "ESE":112.5, "SE":135.0, "SSE":157.5,
              "S":180.0, "SSW":202.5, "SW":225.0, "WSW":247.5, "W":270.0, "WNW":292.5, "NW":315.0, "NNW":337.5};

var raspCOORDs =
{
  VIC:
  {
    tlat: -34.31, tlon: 143.83, ty: 0, tx: 0,
    blat: -39.15, blon: 150.00, by: 977, bx: 999,
    xoff: -5, yoff: -5,
  },
  NSW:
  {
    tlat: -27.66, tlon: 145.81, ty: 0, tx: 0,
    blat: -35.07, blon: 153.64, by: 999, bx: 891,
    xoff: -5, yoff: -5,
  },
  SEQ:
  {
    tlat: -25.33, tlon: 149.67, ty: 0, tx: 0,
    blat: -28.96, blon: 153.80, by: 989, bx: 999,
    xoff: -5, yoff: -5,
  }
}

var RASP_DAYS = 4;

var fs = require("fs");
var path = require("path");
var jsdom = require("jsdom");
var request = require("request");
var request = require("request");
var jimp = require('jimp');

var jquery = fs.readFileSync("jquery.js", "utf-8");

var title;
var sites;
var dates;
var times = [];
var states;
var raspTimes;
var raspDates;
var raspImages;

var adate;
var auth;

var raspCBCount = 0;

function formatYYYYMMDD(date)
{
  return new Date(date - date.getTimezoneOffset()*60*1000).toISOString().substr(0, 10);
}

function saveForecast()
{
  var d = new Date();
  var filename=new Date(d - d.getTimezoneOffset()*60*1000).toISOString().substr(0, 13)+".json";
  var data = {"title":title, "dates":dates, "times":times, "raspDates":raspDates, "raspTimes":raspTimes, "sites":sites};
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

    for(d in site.dates)
    {
      var date = site.dates[d];
        
      for(t in times)
      {
        var time = times[t];

        var cond = date.times[time];

        if(cond)
        {
          var dirStr = cond.dir;
          var kts = cond.kts;

          var dir = dirMap[dirStr];

          // Min and Max being undefined means all directions.
          if(site.minDir === undefined && kts !== null)
          {
            cond.colour = cond.PGColour = "Yellow";
          }
          else if(minDir > maxDir)
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
    }

    for(day=0; day<RASP_DAYS; ++day)
    {
      var date = new Date();
      date.setDate(date.getDate() + day);

      for(t in raspTimes)
      {
        var time = raspTimes[t];

        var forecast = site.dates[formatYYYYMMDD(date)].times;
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
        var count = 0;

        if(raspImages[site.state][day][time])
        {
          raspImages[site.state][day][time].scan(x+coords.xoff,y+coords.yoff,10,10, function(x, y, idx)
          {
            if(x < coords.tx || y < coords.ty || x > coords.bx || y > coords.by) return; // Outside of map

            var r = this.bitmap.data[idx + 0];
            var g = this.bitmap.data[idx + 1];
            var b = this.bitmap.data[idx + 2];
/*
            this.bitmap.data[idx + 0] = 255;
            this.bitmap.data[idx + 1] = 0;
            this.bitmap.data[idx + 2] = 0;
*/
            if(r ==   0 && g ==   0 && b ==   0) return; // Gridline
            if(r == 255 && g == 255 && b == 255) return; // Text

            red   += r;
            green += g;
            blue  += b;
            ++count;
          });
        }

        if(!forecast[time])
          forecast[time] = {};

        if(count)
          forecast[time].raspColour = "#"+Math.round(red/count).toString(16).padStart(2, '0')+
                                          Math.round(green/count).toString(16).padStart(2, '0')+
                                          Math.round(blue/count).toString(16).padStart(2, '0');
      }
    }
  }
/*
  for(s in raspImages)
  {
    if(raspImages[s]['0']['08'])
      raspImages[s]['0']['08'].write(s+".png");
  }
*/
}

function raspImageCB(s, d, t, image)
{
  var state = states[s];
  var time = raspTimes[t];

  if(raspImages[state] === undefined)
    raspImages[state] = {};
  if(raspImages[state][d] === undefined)
    raspImages[state][d] = {};

  raspImages[state][d][time] = image;

  ++t;
  if(t >= raspTimes.length)
  {
    t = 0;
    ++d;
  }
  if(d >= RASP_DAYS)
  {
    d = 0;
    ++s;
  }
  if(s < states.length)
  {
    mkRASPImageCB(s, d, t);
  }
  else
  {
    try
    {
      processForecast();
    }
    catch (err)
    {
      console.log("ERROR processing forecast:"+err);
    }

    saveForecast();
  }
}

function mkRASPImageCB(s, d, t)
{
  var dd = "";
  if(d>0) dd = "+"+d;

  url = "http://ausrasp.com/"+states[s]+"/OUT+"+d+"/FCST/wstar_bsratio.curr."+raspTimes[t]+"00lst.d2.body.png";
  jimp.read(url, function(err, image)
  {
    // RASP images might not exist yet for all days/times, but we carry on to try and get the rest.
    if (err)
      console.log("ERROR mkRASPImageCB:"+url+" "+err);

    raspImageCB(s, d, t, image);
  });
}

function getRASPImages()
{
  raspImages = [];

  if(!raspTimes)
  {
    raspTimes = [];
    for(t=8; t<=18; ++t)
    {
      var time = t.toString().padStart(2, "0");
      raspTimes.push(time);
    }
  }

  if(!raspDates)
  {
    raspDates = [];
    for(day=0; day<RASP_DAYS; ++day)
    {
      var date = new Date();
      date.setDate(date.getDate() + day);
      raspDates.push(formatYYYYMMDD(date));
    }
  }

  if(!states)
  {
    states = [];
    for(s in sites)
    {
      var state = sites[s].state;
      if(!states.includes(state))
        states.push(state);
    }
  }

  mkRASPImageCB(0, 0, 0);
}

function forecast(site, date, window)
{
  var cond = site.dates[date].times;

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

    var t = times[i];

    if(i-offset >=0)
      cond[t] = {"dir":dir[i-offset].innerHTML, "kts":parseInt(kts[i-offset].attributes["data-kts"].nodeValue)};
    else
      cond[t] = {"dir":"", "kts":null};
  }
}

function forecastCB(s, site, d, date, body)
{
  try
  {
    jsdom.env
    ({
      html: body,
      src: [jquery],
      done: function (err, window)
      {
        forecast(site, date, window);

        ++d;
        if(d < dates.length)
          mkForecastCB(s, site, d, dates[d]);
        else
        {
          ++s;
          if(s < sites.length)
            mkOverviewCB(s, sites[s]);
          else
            getRASPImages();
        }
      }
    });
  }
  catch (err)
  {
    console.log("ERROR forecastCB:"+err);
  }
}

/*
To get the wind forcaset for each day we need a query of the form:
http://www.bom.gov.au/australia/meteye/forecast.php?&lat=-38.46&lon=144.06&date=2016-06-05
This produces forecast-example.html

Note that we need to do this call in sub-function to get the closure to work.
*/

function mkForecastCB(s, site, d, date)
{
  request.post(
  {
    url: "http://www.bom.gov.au/australia/meteye/forecast.php?&lat="+site.lat+"&lon="+site.lon+"&date="+date,
    headers: {'User-Agent': "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.81 Safari/537.36"},
    body: '{"adate":"'+adate+'","auth":"'+auth+'"}'
  },
  function (err, response, body)
  {
    if(err)
    {
      console.log("ERROR mkForecastCB:"+err);
      // Retry...
      mkForecastCB(s, site, d, date);
    }
    else
      forecastCB(s, site, d, date, body);
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

function overview(s, site, window)
{
  var datetime = window.$("th[datetime]");
  var img = window.$("img");

  if(!dates)
  {
    dates = [];

    for (d = 0; d<datetime.length; ++d)
    {
      var date = datetime[d].attributes["datetime"].nodeValue;
      dates.push(date);
    }
  }

  for (d in dates)
  {
    // Sometimes the image links are missing. This may result in a wrong forcast
    // as we assume there are the same number of images as dates. So if it's not
    // the last image that's missing the forcast images will be a day out, although
    // it's most likely to be the last one as this will be where they haven't got
    // a forecast.

    var imgSrc = null;
    var imgTitle = "";
    var filename = null;
    if(img[d])
    {
      imgSrc = img[d].attributes["src"].nodeValue;
      imgTitle = img[d].attributes["alt"].nodeValue;

      var uri = "http://www.bom.gov.au"+imgSrc;
      imgFilename = "run/images/"+path.basename(imgSrc);
      filename = "public/"+imgFilename;
      mkImageCB(uri, filename);
    }

    var date = dates[d];

    site.dates[date] = {};
    site.dates[date].img = imgFilename;
    site.dates[date].imgTitle = imgTitle;
    site.dates[date].times = {};
  }

  mkForecastCB(s, site, 0, dates[0]);
}

function overviewCB(s, site, body)
{
  jsdom.env
  ({
    html: body,
    src: [jquery],
    done: function (err, window)
    {
      overview(s, site, window);
    }
  });
}

/*
For each site we retrieve the weeks overview with query of form:
http://www.bom.gov.au/australia/meteye/forecast.php?&lat=-38.46&lon=144.06
This produces overview-example.html

Note that we need to do this call in sub-function to get the closure to work.
*/
function mkOverviewCB(s, site)
{
  site.dates = {};

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
        overviewCB(s, site, body);
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

    mkOverviewCB(0, sites[0]);
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

  dates = null;
  raspDates = null;

  jsdom.env
  ({
    url: "http://www.bom.gov.au/australia/meteye/",
    src: [jquery],
    done: authCB
  });
}

module.exports.retrieveForecast = retrieveForecast;

