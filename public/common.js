var data;
var filters = {};
var sitesFilter = [];

function parseFilters()
{
  var a = location.search.split(new RegExp("[?&]"));
  for(i=0; i<a.length; ++i)
  {
    p = a[i].split("=");
    if(p.length == 2)
      filters[p[0]] = p[1];
  }

  if(filters['sites'])
  {
    if(filters['sites'].length > 0)
    {
      sitesFilter = filters['sites'].split("+");
    }
  }
}

function getFilters()
{
  var f = "";

  for (var key in filters)
  {
    f=f+key+"="+filters[key]+"&"
  }

  return f;
}

function setFilters(page)
{
  window.location = page+"?"+getFilters();
}

function getData(onData)
{
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function ()
  {
    if(xhr.readyState === XMLHttpRequest.DONE)
    {
      if(xhr.status === 200)
      {
        data = JSON.parse(xhr.responseText);
        onData();
      }
    }
  }
  var d = "current";
  if(filters['data']) d = filters['data'];
  filters['data'] = d;

  xhr.open("GET", "run/"+d+".json",true);
  xhr.send();
}

