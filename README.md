# hateoas-parser
Javascript HATEOAS parser

![](badges/badge-lines.svg "Yes, indeed !")
![](badges/badge-branches.svg "Yes, indeed !")
![](badges/badge-functions.svg "Yes, indeed !")
![](badges/badge-statements.svg "Yes, indeed !")

### API

This library exposes 4 methods.

`getEndpoint(index, rel, params, version)`

Pick the "rel" endpoint from the "index" dictionary and resolve it with the provided "params" and "version". 

`parseLinks(result)`

Simple function to convert a raw HATEOAS index result to a more usable key-value Hash

`parseUrl(url, params)`

Does the same as getEndpoint() but with a URL without solving the index-rel-version puzzle before. parseUrl() is internally called by getEndpoint().

`getCleanEndpoint(index, rel)`

Format an endpoint by simply removing all optional or required paramaters in the querystring
