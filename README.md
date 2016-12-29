# gisfile.box.js
L.GisFileBox turns GisFile API box project into a Leaflet layer

<p>
This is the Gisfile Javascript API, version 1.x. It's built as a <a href="http://leafletjs.com/">Leaflet</a>
plugin. You can <a href="http://gisfile.com/api/1.0/doc/box/">read more about the Gisfile API</a>
</p>

<h2>
<a id="user-content-exampls" class="anchor" href="#exampls" aria-hidden="true">
Examples
</h2>

<ul>
<li><a href="http://gisfile.com/map/ukraine/box">Ukraine map</a></li>
<li><a href="http://gisfile.com/map/usa/box">USA map</a></li>
</ul>

<h2>
<a id="user-content-api" class="anchor" href="#api" aria-hidden="true">
<span class="octicon octicon-link"></span></a>
<a href="http://gisfile.com/js/gisfile.box.js">API</a>
</h2>

<p>Latest version of the GISfile JavaScript API in the <code>src</code> directory</p>

<h2>
<a id="user-content-examples" class="anchor" href="#examples" aria-hidden="true">
<span class="octicon octicon-link"></span></a>
<a href="http://gisfile.com/api/1.0/doc/box/">Usage</a>
</h2>

<p>One way of usage is via the Gisfile CDN:</p>

<div class="highlight highlight-html">
<pre>
&lt;script src='http://gisfile.com/js/gisfile.box.js'&gt;&lt;/script&gt;
&lt;script src='http://gisfile.com/js/jszip.min.js'&gt;&lt;/script&gt;
</pre>
</div>

<p>The <code>gisfile.json.js</code> file does not includes the Leaflet and jsZip library. 
You will have to include the Leaflet and jsZip yourself.</p>

<div class="highlight highlight-html">
<pre>
&lt;html&gt;
    &lt;head&gt;
        &lt;script src="http://gisfile.com/js/jquery/jquery-1.8.0.min.js"&gt;&lt;/script&gt;
        &lt;link rel="stylesheet" href="http://gisfile.com/css/leaflet.css" /&gt;
        &lt;script src="http://gisfile.com/js/leaflet.js"&gt;&lt;/script&gt;
        &lt;script src="http://gisfile.com/js/gisfile.box.js"&gt;&lt;/script&gt;
        &lt;script src="http://gisfile.com/js/jszip.min.js"&gt;&lt;/script&gt;
    &lt;/head&gt;
    &lt;body&gt;
        &lt;div id="map" style="width: 100%; height: 500px"&gt;&lt;/div&gt;

        &lt;script type="text/javascript"&gt;
            var map = new L.map("map", {
                    center: [50.4487, 30.5873], 
                    zoom: 10
                });

            $(function() {
                new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                var gisfile = new L.GisFileBox({map : 'SpatialTown'}).addTo(map);
                gisfile._update();
            })
        &lt;/script&gt;
    &lt;/body&gt;
&lt;/html&gt;
</pre>
</div>

<h2>
<a id="user-content-references" class="anchor" href="#references" aria-hidden="true">
<span class="octicon octicon-link"></span></a>
<a href="http://gisfile.com/api/1.0/doc/box/">References</a>
</h2>

<p>
<a href="http://gisfile.com/api/1.0/doc/">Description</a><br>
<a href="http://gisfile.com/api/1.0/doc/quick-start/">First Start</a><br>
<a href="http://gisfile.com/api/1.0/doc/general/">General Information</a><br>
<a href="http://gisfile.com/api/1.0/doc/jsapi/">Connecting API</a><br>
<a href="http://gisfile.com/api/1.0/doc/jsonp/">Dynamic JSONP Layer</a><br>
<a href="http://gisfile.com/api/1.0/doc/box/">Box Layer</a><br>
<a href="http://gisfile.com/designer.htm">Map Designer</a>
</p>
