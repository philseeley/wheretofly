Nodejs based container to summarise weather conditions at multiple Australian locations. Initially built for Hang Gliding sites, but can be used for any wind dependent activity.  It retrieves the wind and weather information from the BOM MetEye site.

**Note:** the container does not get or store any information from users. All the filtering, sorting and location awareness is performed in the browser.

# Configuration
The container requires a TLS key and certificate and takes a JSON file containing an array of site details. TLS is required for the location awareness to work and free certificates can be obtained from [Let’s Encrypt](https://letsencrypt.org).

The values in the `sites.json` file are:

**Required:**
* `sites` - Array of sites.

**Optional:**
* `title` - Used to override the default title of "Where To Fly".

The values for each `sites` entry are:

**Required:**
* `name` - Unique entry name. Used for filtering.
* `title` - Name shown on the forecast.
* `lat` - site's latitude in decimal to two significant figures.
* `lon` - site's longitude in decimal to two significant figures.
* `minSpeed` - minimum favourable speed in knots. See note [4].
* `maxSpeed` - maximum favourable speed in knots.
* `minPGSpeed` - minimum favourable speed for Paragliders in knots.
* `maxPGSpeed` - maximum favourable speed for Paragliders in knots.
* `state` - the RASP state covering for the site.

**Optional:**
* `url` - Link to a description of the site.
* `weather_url` - link to a specific forecast for the site.
* `obs_url` - link to the site's current weather observations.
* `minDir` - minimum wind favourable direction. See note [1].
* `minDir` - maximum wind favourable direction. Must be clockwise from minDir. See note [2].
* `dir` - best wind direction.

Notes:
1. Directions must be one of  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW".
2. If no directions are specified all directions are considered favourable.
3. ACT sites are classed as VIC. See http://ausrasp.com.
4. Where the forecast and the expected wind speeds o launch differ, the forecast speeds should be used. For example, you can expect about 10 kts more on launch at Lake George than the forecast. So a maxSpeed of 10 would be a good value for Hang Gliders, as you would expect 20 kts on launch.

**Example `sites.json` file:**

```json
{
"title": "Where To Fly",
"sites":
  [
    {
      "name":"gearys_gap",
      "title":"Lake George (Geary's Gap)",
      "url":"http://www.vhpa.org.au/Sites/Lake%20George%20(Geary's%20Gap).html",
      "weather_url":"http://wind.willyweather.com.au/nsw/southern-tablelands/lake-george.html",
      "obs_url":"http://www.acthpa.org/newwind/lakegeorge/index.php",
      "lat":-35.09,
      "lon":149.37,
      "minDir": "NE",
      "maxDir": "SE",
      "minSpeed": 5,
      "maxSpeed": 10
    },
    {
      "name":"spring_hill",
      "title":"Spring Hill",
      "url":"http://www.vhpa.org.au/Sites/Spring%20Hill.html",
      "weather_url":"http://wind.willyweather.com.au/nsw/southern-tablelands/nanima.html",
      "obs_url":"http://www.acthpa.org/newwind/springhill/index.php",
      "lat":-35.09,
      "lon":149.08,
      "minDir": "SW",
      "maxDir": "NW",
      "minSpeed": 5,
      "maxSpeed": 10
    },
  ]
}
```

# Container configuration

The container expects two shares:
* /usr/src/app/run - read/write - must contain `sites.json`, `key.pem` and `cert.pem`. See Note [1]. An access.log is written here.
* /usr/src/app/public/run - read/write - stores the forecast history files.

The container exposes two ports:
* 8080 - http
* 8443 - https

Notes:
1. If using [Let’s Encrypt](https://letsencrypt.org) certificates, include the cross signed CA certificate in the `cert.pem` file to ensure it's accepted by all browsers.

# Current Limitations - TODO:
* The container timezone is fixed to AEDT.
