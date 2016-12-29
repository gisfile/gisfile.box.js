/*
 * L.GisFileBox turns GisFile API box (http://gisfile.com/api/1.0/doc/box) data into a Leaflet layer.
 */
/*
if (!L.Util.template) {
    L.Util.template = function (str, data) {
        return str.replace(/\{ *([\w_]+) *\}/g, function (str, key) {
            var value = data[key];
            if (!data.hasOwnProperty(key)) {
                throw new Error('No value provided for variable ' + str);
            } else if (typeof value === 'function') {
                value = value(data);
            }

            return value;
        });
    }
}
*/
L.GisFileTip = L.Class.extend({
    initialize: function (map) {
        this._map = map;
        this._popupPane = map._panes.popupPane;
        this._container = L.DomUtil.create('div', 'leaflet-tooltip', this._popupPane);
    },

    dispose: function () {
        if (this._container) {
            this._popupPane.removeChild(this._container);
            this._container = null;
        }
    },

    updateContent: function (labelText) {
        if (!this._container) {
            return this;
        }
        L.DomUtil.addClass(this._container, 'leaflet-tooltip-single');
        this._container.innerHTML = '<span>' + labelText.text + '</span>';
        return this;
    },

    updatePosition: function (latlng) {
        var pos = this._map.latLngToLayerPoint(latlng),
            tooltipContainer = this._container;

        if (this._container) {
            tooltipContainer.style.visibility = 'inherit';
            L.DomUtil.setPosition(tooltipContainer, pos);
        }

        return this;
    }
});

L.GisFileBox = L.Class.extend({
    includes: L.Mixin.Events
    , timer: null
    , mouseMoveTimer: null
    , counter: 0
    , options: {
        url: '//gisfile.com/'
        , mask: 'map/{m}/{z}/{x}/{y}.zip'
        , map: ''
        , opacity: 1
        , attribution: '<a href="http://gisfile.com" target="_blank">GISFile</a>'
        , showobjects: true
        , showlables: true
        , showtips: false
        , showfield: 'name'
        , minZoom : 0
        , maxZoom : 20
        , minSize : 10
    }

    , initialize: function (options) {
        var that = this;
        L.setOptions(that, options);
        that._hash = {};
        that._tiles = {};
        that._mouseIsDown = false;
        that._popupIsOpen = false;        
        that.url = that.options.url +that.options.mask;
        that.defaultIcon = L.Icon.Default.extend({ options: { iconUrl: that.options.url +'css/icons/marker-icon.png' } });
    }

    , setOptions: function (newOptions) {
        var that = this;
        L.setOptions(that, newOptions);
        that._update();
    }

    , onAdd: function (map) {
        var that = this;
        that._map = map;

        if (L.GisFileTip) {
            that._tips = new L.GisFileTip(that._map);
        }

        map.on('viewreset', that._update, that);
        map.on('moveend', that._update, that);
        map.on('zoomend', that._update, that);
        map.on('mousemove', that._mousemove, that);
        map.on('mouseout', that._mouseout, that);
        map.on('mousedown', that._mousedown, that);
        map.on('mouseup', that._mouseup, that);
        map.on('popupopen', that._popup_open, that);
        map.on('popupclose', that._popup_close, that);

        that.getLayers(map);
        //that._update();
    }

    , onRemove: function (map) {
        var that = this;

        map.off('viewreset', that._update, that);
        map.off('moveend', that._update, that);
        map.off('zoomend', that._update, that);
        map.off('mousemove', that._mousemove, that);
        map.off('mouseout', that._mouseout, that);
        map.off('mousedown', that._mousedown, that);
        map.off('mouseup', that._mouseup, that);
        map.off('popupopen', that._popup_open, that);
        map.off('popupclose', that._popup_close, that);
        
        if (L.GisFileTip && this._tips != undefined) {
            this._tips.dispose();
            that._tips = null;
        }
        
        this._popup_close();
        this._hideFeature();        
        
        for (var l in this.geojsonLayers) {
            var layer = this.geojsonLayers[ l];
            
            if (layer && this._map.hasLayer( layer)) {
                layer.clearLayers();
                this._map.removeLayer( layer);
            }
        }
        
        if (this._lable && this._map.hasLayer( this._lable)) {
            this._lable.clearLayers();
            this._map.removeLayer( this._lable);
        }
    }
    
    , getLayers: function(map) {
        var that = this;
        var o = that.options;
        that.baseMaps = {}; //{'OpenSreetMap': that.options.osm};
        that.overlayMaps = {};
        that.geojsonLayers = [];

        $.ajax({
            url : that.options.url +'map/' +o.map +'/json'
            , async: true
            , success: function(data) {
                if (data) {
                    if (typeof data == 'string') {
                        data = JSON.parse(data);
                    }
                    
                    var layers = data;
                    var setview = (o.setview != undefined ? o.setview : true);
                    var setviewf = false;
                    var i = 1000;
                    var baseMaps = that.baseMaps;
                    var overlayMaps = that.overlayMaps;
                    var geojsonLayers = that.geojsonLayers;

                    for (var layer in layers) 
                    {
                        if (layers[ layer].style) 
                        {
                            if (setview && layers[ layer].style.lat && layers[ layer].style.lng && layers[ layer].style.zoom) {
                                map.setView([layers[ layer].style.lat, layers[ layer].style.lng], layers[ layer].style.zoom);
                                setviewf = true;
                            }
                        }

                        if (layers[ layer].show && Boolean( layers[ layer].show) == true) 
                        {
                            // Tiles layer

                            if (layers[ layer].type && (layers[ layer].type.indexOf("TileLayer") >= 0 || layers[ layer].type.indexOf("TileImage") >= 0)) 
                            {                            
                                if (layers[ layer].layer) 
                                {
                                    var props = {minZoom: 0, maxZoom: 20};
                                    if (layers[ layer].zoom && layers[ layer].zoom == true) {
                                        props.minZoom = layers[ layer].minZoom;
                                        props.maxZoom = layers[ layer].maxZoom;
                                    }
                                    
                                    if (layers[ layer].type == "TileImage" && layers[ layer].url) {
                                        geojsonLayers[ layer] = new L.TileLayer( layers[ layer].url, props);
                                        
                                        if (layers[ layer].style && layers[ layer].style.opacity)
                                            geojsonLayers[ layer].setOpacity( layers[ layer].style.opacity);
                                    }

                                    if (layers[ layer].type == "TileLayer" && layers[ layer].url)
                                        geojsonLayers[ layer] = new L.TileLayer( layers[ layer].url, props);

                                    if (layers[ layer].type == "TileLayerGoogle")
                                        geojsonLayers[ layer] = new L.Google( layers[ layer].subType);

                                    if (layers[ layer].type == "TileLayerYandex")
                                        geojsonLayers[ layer] = new L.Yandex( layers[ layer].subType);

                                    geojsonLayers[ layer].params = layers[ layer];
                                    geojsonLayers[ layer].addTo( map);

                                    var lName = layers[ layer].layer;

                                    if (layers[ layer].name)
                                        lName = layers[ layer].name;

                                    overlayMaps[ lName] = geojsonLayers[ layer];
                                }
                            }

                            // Objects Layer
                            
                            if (!layers[ layer].type || layers[ layer].type.indexOf("Overlay") >= 0 || layers[ layer].type.indexOf("File") >= 0) 
                            {                            
                                if (layers[ layer].layer) 
                                {
                                    //geojsonLayers[ layer] = new L.FeatureGroup();
                                    geojsonLayers[ layer] = new L.geoJson();
                                    geojsonLayers[ layer].params = layers[ layer];
                                    geojsonLayers[ layer].addTo( map);
                                    var lName = layers[ layer].layer;

                                    if (layers[ layer].name)
                                        lName = layers[ layer].name;

                                    overlayMaps[ lName] = geojsonLayers[ layer];
                                }
                            }
                            
                            if (that._map && that._map._maplist) {
                                var control = that._map._maplist;
                                control.addOverlay( overlayMaps[ lName], lName); 
                            }
                        }
                    }

                    that.getFields();
                }
            }
        });
    }

    , getFields: function() {
        var that = this;
        var o = that.options;
        
        $.ajax({
            url : that.options.url +'map/' +o.map +'/fields'
            , async: true
            , success: function(data) {
                if (data) {
                    if (typeof data == 'string') {
                        data = JSON.parse(data);
                    }
                    var layers = data;
                    
                    for (var field in layers) {
                        for (var l in that.geojsonLayers) {
                            var layer = that.geojsonLayers[ l];
                            
                            if (layer.params && layer.params.layer == field) {
                                layer.fields = layers[ field];
                                break
                            }
                        }
                    }
                    
                    that._showHash();
                }
            }
        });
    }

    , addTo: function (map) {
        map.addLayer(this);
        return this;
    }

    , getAttribution: function () {
        return this.options.attribution;
    }

    , getLayerById: function (id) {
        var layer = undefined;
        
        for (var l in this.geojsonLayers) {
            var json = this.geojsonLayers[ l];

            if (json.params && json.params.id == id) {
                layer = json;
                break
            }
        }
        
        return layer;
    }
    , _hideFeature: function () {
    	var that = this;
        if (that._feature && !that._popupIsOpen) {
            that._feature.geometry.off('mouseout');
            
            //if (!that.options.showobjects || (that._layer && !that._layer.hasLayer( that._feature.geometry))) {
            //    that._map.removeLayer(that._feature.geometry);
            //} else {
                var type = that._feature.type;
                var options = that._feature.geometry._options;
                
                if (that.isPoint( type)) {
                    
                } else {
                    that._feature.geometry.setStyle( {fillColor: options.fillColor, fillOpacity: options.fillOpacity, weight: options.weight, opacity: options.opacity, color: options.color});
                }
            //}
            
            that._feature = null;
        }
    }

    , _showHash:function() {
        
        for (var l in this.geojsonLayers) {
            var layer = this.geojsonLayers[ l];
            
            if (layer && this._map.hasLayer( layer)) {
                if (layer.clearLayers && typeof layer.clearLayers !== 'undefined')
                    layer.clearLayers();
                this._map.removeLayer( layer);
            }            

            if (layer && layer.params && layer.params.zoom && layer.params.zoom == true) {
                if (this._map.getZoom() >= layer.params.minZoom && this._map.getZoom() <= layer.params.maxZoom) {
                    if (!this._map.hasLayer(layer))
                        this._map.addLayer(layer);
                } else {
                    if (this._map.hasLayer(layer))
                        this._map.removeLayer(layer);
                }
            } else {
                if (!this._map.hasLayer( layer)) {
                    this._map.addLayer( layer);
                }
            }
        }
    
        /*
        if (this._layer && this._map.hasLayer( this._layer)) {
            this._layer.clearLayers();
            this._map.removeLayer( this._layer);
        }
        
        if (!this._layer) {
            this._layer = L.layerGroup();
        }

        if (!this._map.hasLayer( this._layer)) {
            this._map.addLayer( this._layer);
        }
        */
        if (this.options.showlables) {
            if (this._lable && this._map.hasLayer( this._lable)) {
                this._lable.clearLayers();
                this._map.removeLayer( this._lable);
            }
            
            if (!this._lable) {
                this._lable = L.layerGroup();
            }
            
            if (!this._map.hasLayer( this._lable)) {
                this._map.addLayer( this._lable);
            }
        }
        
        var zoom = this._map.getZoom();
        if (zoom >= this.options.minZoom && zoom <= this.options.maxZoom) {
            /*
            for (var h in this._hash) {
                var hash = this._hash[h];
                for (var i in hash) {
                    this._drawHash( h, hash[i]);
                } 
            }
            */
            for (var l in this.geojsonLayers) {
                var layer = this.geojsonLayers[l];
                
                if (layer && layer.params && layer.params.id && this._hash[ layer.params.id]) {
                    var hash = this._hash[ layer.params.id];
                    for (var i in hash) {
                        this._drawHash( layer.params.id, hash[i]);
                    } 
                }
            }
        } else {
            if (L.GisFileTip && this._tips != undefined && this._tips != null) {
                this._hideFeature();
                this._tips.dispose();
                this._tips = null;
            }
        }
    }

    , _drawHash:function(id, hash) {
        var that = this;
        var bounds = this._map.getBounds();       
        var p1 = this._map.latLngToLayerPoint( hash.bounds.getSouthWest());
        var p2 = this._map.latLngToLayerPoint( hash.bounds.getNorthEast());
        var layer = this.getLayerById( id), param = layer && layer.params ? layer.params : undefined;        
        
        if (param && (this.isPoint( hash.type) || p1.x -p2.x >= this.options.minSize || p1.y -p2.y >= this.options.minSize))
        {
            if (bounds.contains( hash.bounds) || bounds.intersects( hash.bounds)) {
                this.setHashStyle( hash, param);
                
                if (layer && !this._map.hasLayer( hash.geometry)) {
                    //hash.geometry.addTo(this._layer);
                    hash.geometry.addTo(layer);
                }

                if (this.options.showlables) {
                    if (this.isPoint( hash.type) || p1.x -p2.x >= this.options.minSize || p1.y -p2.y >= this.options.minSize) {
                        if (layer && layer.params && layer.params.lable && layer.params.lable.field) {
                            var layerLable = layer.params.lable;
                            var s = hash.properties[ layerLable.field.toLowerCase()];
                            var l = that.getWidthOfText( s, 'leaflet-label-overlay') /2;
                            var labelTitle = new L.LabelOverlay( hash.bounds.getCenter(), s, {offset: new L.Point(-l, 8), 
                                                                 minZoom: layerLable.minZoom ? layerLable.minZoom : 10, 
                                                                 maxZoom: layerLable.maxZoom ? layerLable.maxZoom : 20});
                            this._lable.addLayer( labelTitle);
                        }
                    }
                }
            }
        }
    }
    
    , setHashStyle: function (hash, param){
        if (this.isPoint( hash.type)) {
            var layerIcon;
            var that = this;

            if (param.style && param.style.icon && param.style.icon.url)
            {
                if (param.style.icon.width && param.style.icon.height) {
                    layerIcon = this.setIcon( this.options.url +param.style.icon.url, param.style.icon.width, param.style.icon.height);
                } else {
                    layerIcon = this.setIcon( this.options.url +param.style.icon.url, 36, 36);
                }

                var img = new Image();
                img.onload = function() {
                    layerIcon = that.setIcon( that.options.url +param.style.icon.url, img.width, img.height);
                }
                img.src = this.options.url +param.style.icon.url;

            } else {
                layerIcon = new this.defaultIcon();
            }

            var lStyle = param.styles;

            if (lStyle && lStyle.style) 
            {
                var val = hash.properties[ lStyle.field];
                var style = this.getStyle( val, lStyle);

                if (style) 
                {
                    if (hash.geometry._layers)
                       hash.geometry._layers[ hash.geometry._leaflet_id -1].options.icon = this.iconCount( val, this.valColor( style.color));
                    else
                       hash.geometry.options.icon = this.iconCount( val, this.valColor( style.color));
                }

            } else {
                if (hash.geometry._layers)
                   hash.geometry._layers[ hash.geometry._leaflet_id -1].setIcon( layerIcon);
                else
                   hash.geometry.setIcon( layerIcon);
            }

        } else {
            var layerStyle = param && param.styles ? param.styles : undefined;
            var style = this.style( hash, this, param.styles);
            if (style) hash.geometry.setStyle( style);

            if (param && param.style)
            {
                if (param.style.weight)
                    hash.geometry.setStyle({weight: param.style.weight});

                if (param.style.color)
                    hash.geometry.setStyle({color: this.valColor( param.style.color)});

                if (!layerStyle && param.style.fillColor) {
                    if (param.style.fillColor == "none")
                        hash.geometry.setStyle({fillColor: param.style.fillColor});
                    else
                        hash.geometry.setStyle({fillColor: this.valColor( param.style.fillColor)});
                }

                if (param.style.fillOpacity)
                    hash.geometry.setStyle({fillOpacity: param.style.fillOpacity});
            } 
        }
    }
    
    , getWidthOfText: function (str, nameClass){
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext("2d");
        ctx.font = '12px/1.4 "Helvetica Neue", Arial, Helvetica, sans-serif;';
        var width = ctx.measureText(str).width;
        return width;
    }            

    , highlightFeature: function (e) 
    {
        var layer = e.target;
        layer.setStyle({
            weight: 1,
            color: '#666',
            dashArray: '',
            fillOpacity: 0.7
        });

        if (!L.Browser.ie && !L.Browser.opera) {
            layer.bringToFront();
        }
    }
            
    , _showFeature:function(feature, point, layer) {
    	var that = this;
        if (!((that._feature && that._feature.id==feature.id) || that._popupIsOpen)) {
            that._hideFeature();
            that._feature = feature;
            var options = {};
            options = that._feature.geometry.options;
            that._feature.geometry._options = options;
            
            if (that.isPoint( feature.type)) {
                //point = feature.geometry._latlng;
            } else {
                if (feature.type == "LineString") {
                    feature.geometry.setStyle( {fillColor: 'blue', weight: 3, opacity: 0.3, color: 'blue'});
                } else {
                    if (feature.geometry.options) {
                        var o = feature.geometry.options;
                        feature.geometry.setStyle( {fillOpacity: o.fillOpacity < 0.8 ? o.fillOpacity -0.2 : o.fillOpacity +0.2,
                                                    opacity: o.opacity < 0.8 ? o.opacity -0.2 : o.opacity +0.2});
                    } else
                        feature.geometry.setStyle( {fillColor: 'blue', weight: 1, opacity: 0.3, color: 'blue'});
                }

                if (that.options.style) {
                    that._feature.geometry.setStyle(that.options.style(that._feature));
                }
            }
            
            if (that.options.onActiveFeature) {
                that.options.onActiveFeature(that._feature, that._feature.geometry);
            } else {
                //if (layerContent == 'Images') {
                if (layer && layer.params && layer.params.type && layer.params.layer) {
                    if (layer.params.type == "File") {
                        var items = [];
                        var data = feature.properties;
                        if (data.filename) items.push( "<a href='" +that.options.url +data.filename +"' target='_blank'><img src='" +that.options.url +data.filename +"?t=2'></a>");
                        if (data.filenote) items.push( "<br><div class='lead'>" +data.filenote +"</div>");
                        var popupContent = "<div class='modal-body' style='width: 287px'>" +"<p>" +items.join( "") +"</p>" +"</div>";                        
                        that._feature.geometry.bindPopup( popupContent);
                    } else {
                        that._feature.geometry.bindPopup( '{"url":"' +that.options.url +'api?json=table&layer=' +layer.params.layer +'&id=' +feature.id +'","id":' +layer.params.id +'}');
                    }
                }
            }

            if (L.GisFileTip && that.options.showtips && that._feature.properties) {
                if (that._tips == null) that._tips = new L.GisFileTip(that._map);
                that._tips.updateContent({ text: that._feature.properties[ that.options.showfield]});
                that._tips.updatePosition( point); //that._feature.bounds.getCenter());
            }

            that._feature.geometry
            .on('mouseout', function (e) {
                var size = that._map.getSize();
                var point = e.containerPoint ? e.containerPoint : e.originalEvent;
                if (point.x<0 || point.y<0 || point.x>(size.x-10) || point.y>(size.y-10)) {
                    that._hideFeature();
                }
                if (L.GisFileTip) {
                    this._tips = null;
                }
            })
            .addTo(that._map);
        }
    }

    , _mousemove: function (e) {
    	var that = this;
        var zoom = this._map.getZoom();
        
        if (zoom >= this.options.minZoom && zoom <= this.options.maxZoom) 
        var point = e.latlng, features = [];
    	for (var h in that._hash) {
            var hash = that._hash[h];
            var seek = true;
            var layer = that.getLayerById( h);
            
            if (layer && layer.params && layer.params.zoom && layer.params.zoom == true) {
                if (!(this._map.getZoom() >= layer.params.minZoom && this._map.getZoom() <= layer.params.maxZoom)) {
                    seek = false;
                }
            }

            var feature = !seek ? [] : that._filter(hash, function (item) {
                var p1 = that._map.latLngToLayerPoint( item.bounds.getSouthWest());
                if (that.isPoint(item.type)) {
                    var p2 = that._map.latLngToLayerPoint( point);
                    return (Math.abs(p1.x -p2.x) <= that.options.minSize && (p1.y -p2.y) > 0 && (p1.y -p2.y) <= 40)
                } else {
                    var p2 = that._map.latLngToLayerPoint( item.bounds.getNorthEast());
                    return ((p1.x -p2.x >= that.options.minSize || p1.y -p2.y >= that.options.minSize) && item.bounds.contains(point) && that._pointInPolygon(point, item.geometry))
                }
            });
            
            if (feature.length>0) {
                for (var f in feature) {
                    feature[f].ld = h;
                    features.push(feature[f]);
                }
            }
    	}
        if (features.length>0) {
            var feature = (features.length == 1 ? features[0] : that._chooseBestFeature(features));
            var layer = that.getLayerById( feature.ld);
            that._showFeature(feature, e.latlng, layer);
        } else {
            that._hideFeature();
        }
    }

    , _mousedown: function () {
    	this._mouseIsDown = true;
    }

    , _mouseup: function () {
    	this._mouseIsDown = false;
    }

    , _mouseout: function () {
        this._hideFeature();
    }

    , _popup_open: function (e) {
        var that = this;
        if (e.popup._content && e.popup._content.indexOf( "<") == -1) {
            var info = JSON.parse( e.popup._content +"");
            var url = info.url;
            var layer = that.getLayerById( info.id);
            e.popup.setContent('<img id="cload" src="' +that.options.url +'img/loading.gif" style="display: none;">');

            jQuery.ajax({
                url: url, 
                type: 'GET',
                async: true,
                dataType: 'text',
                success: function(response) {
                    if (response) 
                    {
                        var data = JSON.parse( response);
                        if (data && data[0] && data[0][0] && data[0][0].properties) 
                        {
                            var props = data[0][0].properties;
                            var items = that.getItems(that, layer.fields, props);

                            var popupContent = "<div class='modal-body' style='width: 287px'>" +
                                               items.join( "") +
                                               "</div>";

                            e.popup.setContent(popupContent);
                        }
                    }
                }
            });
        }        
    	this._popupIsOpen = true;
    }

    , _popup_close: function () {
    	this._popupIsOpen = false;
    }

    , _chooseBestFeature: function (features) {
        var that = this
            //, bestLookingArea = that._boundsArea(that._map.getBounds())/12
            , bestFeatureIndex = 0
            , bestFeatureScale = that._boundsArea(features[0].bounds); //bestLookingArea;

        //if (bestFeatureScale < 1) {bestFeatureScale = 1/bestFeatureScale}

        for (var i=1; i<features.length;i++) {
            var featureArea = that._boundsArea(features[i].bounds)
              , featureScale = featureArea; //bestLookingArea;
            //if (featureScale < 1) {featureScale = 1/featureScale}

            if (featureScale<bestFeatureScale) {
                bestFeatureIndex = i;
                bestFeatureScale = featureScale;
            }
        }
        return features[bestFeatureIndex];
    }

    , _boundsArea: function(bounds) {
        var sw = bounds.getSouthWest()
            , ne = bounds.getNorthEast();
        return (ne.lat-sw.lat)*(ne.lat-sw.lat)+(ne.lng-sw.lng)*(ne.lng-sw.lng)
    }

    , _filter: function(obj, predicate) {
        var res=[];
        
        $.each(obj, function(index,item) {
            if (predicate(item)) {res.push(item)}
        });

        return res;
    }

    , _pointInPolygon: function (point, polygon) {
        // ray-casting algorithm based on
        // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

        var x = point.lng
        , y = point.lat
        , poly = polygon.getLatLngs()
        , inside = false;

        for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {

            var xi = poly[i].lng, yi = poly[i].lat
            , xj = poly[j].lng, yj = poly[j].lat
            , intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

            if (intersect) inside = !inside;

        }

        return inside;
    }

    , _update: function () {
        
        var that = this;

        if (that.timer) {
            window.clearTimeout(that.timer);
        }

        that.timer = window.setTimeout(function() {
            if (that.options.showobjects) {
                that._showHash();
            }

            var zoom = that._map.getZoom();
                
            if (zoom > that.options.maxZoom || zoom < that.options.minZoom) {
                return;
            }

            var tbounds = that._map.getPixelBounds(),
                tileSize = 256;

            var bounds = L.bounds(
                tbounds.min.divideBy(tileSize)._floor(),
                tbounds.max.divideBy(tileSize)._floor());

            var queue = [], center = bounds.getCenter();
            var j, i, point;

            for (j = bounds.min.y; j <= bounds.max.y; j++) {
                for (i = bounds.min.x; i <= bounds.max.x; i++) {
                    point = new L.Point(i, j);

                    if (that._tileShouldBeLoaded(point)) {
                        queue.push(point);
                    }
                }
            }

            var tilesToLoad = queue.length;
            if (tilesToLoad === 0) { return; }

            queue.sort(function (a, b) {
                return a.distanceTo(center) - b.distanceTo(center);
            });
            
            that.counter += tilesToLoad;

            for (i = 0; i < tilesToLoad; i++) {
                that._loadTile( queue[i]);
            }
        },0);
    },

    // -------------------------------------------------------------------------
    
    _loadTile: function (tilePoint) {
        var that = this;
        this._adjustTilePoint(tilePoint);
        var url = that.getTileUrl(tilePoint);

        if (window.XMLHttpRequest === undefined) {
            window.XMLHttpRequest = function() {
                try {
                    return new ActiveXObject("Microsoft.XMLHTTP.6.0");
                }
                catch (e1) {
                    try {
                        return new ActiveXObject("Microsoft.XMLHTTP.3.0");
                    }
                    catch (e2) {
                        throw new Error("XMLHttpRequest is not supported");
                    }
                }
            };
        }

        var oReq = new XMLHttpRequest();
        oReq.open("GET", url, true);
        oReq.responseType = "arraybuffer";
        oReq.onload = function (oEvent) {
            if (oReq.response && oReq.response.byteLength > 0) {
                var arrayBuffer = oReq.response;
                if (arrayBuffer) {
                    var z = new JSZip();
                    z.load(arrayBuffer);
                    /*
                    $.each(z.files, function (index, zipEntry) {
                        var data = z.file(zipEntry.name).asText();
                        var name = zipEntry.name;
                        if (name.indexOf( ".") > 0) name = name.substring(0,name.indexOf( "."));
                        that.parseGeoJson(name, data, that);
                    })
                    */
                    for (var l in that.geojsonLayers) {
                        var layer = that.geojsonLayers[l];                        
                        if (layer && layer.params && layer.params.id && z.files[ layer.params.id +'.json']) {
                            var name = z.files[ layer.params.id +'.json'].name;
                            var data = z.file(name).asText();
                            if (name.indexOf( ".") > 0) name = name.substring(0,name.indexOf( "."));
                            that.parseGeoJson(name, data, that);
                        }
                    }
                }
            }
            that._tiles[tilePoint.x + ':' +tilePoint.y] = '';
            that.counter--;
        };
        oReq.send(null);
    },

    parseGeoJson: function (name, data, that) {
        if (typeof data == 'string') {
            data = JSON.parse(data);
        }
        
        if (that._hash[name] == undefined) { that._hash[name] = {}; };
        var hash = that._hash[name];

        for (var i=0;i<data.length;i++) 
        {
            var item = data[i];
            var id = parseInt( item.id);
            var geometry = item.type === 'Feature' ? item.geometry : item,
                coords = geometry ? geometry.coordinates : null
            if (coords && geometry) {
                if (hash[id] == undefined) {
                    var pro = {}, obj = undefined;
                    pro[ "id"] = id;
                    pro[ "type"] = geometry.type;
                    pro[ "properties"] = item.properties;
                    switch (geometry.type) {
                        case 'Point':
                            var latlng = this.coordsToLatLng(coords);
                            obj = new L.Marker(latlng);
                            break;
                        case 'MultiPoint':
                            var latlngs = [];
                            for (var i = 0, len = coords.length; i < len; i++) {
                                latlng = this.coordsToLatLng(coords[i]);
                                latlngs.push( new L.Marker(latlng));
                            }
                            obj = new L.FeatureGroup(latlngs);
                            break;
                        case 'LineString':
                        case 'MultiLineString':
                            var latlngs = this.coordsToLatLngs(coords, geometry.type === 'LineString' ? 0 : 1, that.coordsToLatLng);
                            obj = new L.Polyline(latlngs); //, options);
                            break;
                        case 'Polygon':
                        case 'MultiPolygon':
                            var latlngs = that.coordsToLatLngs(coords, geometry.type === 'Polygon' ? 1 : 2, that.coordsToLatLng);
                            obj = new L.Polygon(latlngs);
                            break;
                    }
                    if (obj != undefined) {
                        pro[ "geometry"] = obj;
                        hash[id] = pro;
                    }
                }
                
                if (!hash[ id].bounds && hash[ id].geometry) {
                    if (hash[ id].geometry._latlng) {
                        hash[ id].bounds = L.latLngBounds(hash[ id].geometry._latlng,hash[ id].geometry._latlng);
                    } else if (hash[ id].geometry._latlngs) {
                        hash[ id].bounds = hash[ id].geometry.getBounds();
                    } else if (hash[ id].geometry._layers) {
                        hash[ id].bounds = hash[ id].geometry.getBounds();
                    }
                }

                if (that.options.showobjects) {
                    that._drawHash( name, hash[ id]);
                }               
            }
        }
    },

    coordsToLatLng: function (coords) {
        if (coords.length == 3)
            return new L.LatLng(coords[1], coords[0], coords[2]);
        else
            return new L.LatLng(coords[1], coords[0], 0);
    },
    
    coordsToLatLngs: function (coords, levelsDeep, coordsToLatLng) {
        var latlngs = [];

        for (var i = 0, len = coords.length, latlng; i < len; i++) {
            latlng = levelsDeep ?
                    this.coordsToLatLngs(coords[i], levelsDeep - 1, coordsToLatLng) :
                    (coordsToLatLng || this.coordsToLatLng)(coords[i]);

            latlngs.push(latlng);
        }

        return latlngs;
    },
    
    _tileShouldBeLoaded: function (tilePoint) {
        if ((tilePoint.x + ':' + tilePoint.y) in this._tiles) {
            return false; // already loaded
        }

        var options = this.options;

        if (!options.continuousWorld) {
            var limit = this._getWrapTileNum();

            // don't load if exceeds world bounds
            if ((options.noWrap && (tilePoint.x < 0 || tilePoint.x >= limit)) ||
                tilePoint.y < 0 || tilePoint.y >= limit) { return false; }
        }

        if (options.bounds) {
            var tileSize = options.tileSize,
                nwPoint = tilePoint.multiplyBy(tileSize),
                sePoint = nwPoint.add([tileSize, tileSize]),
                nw = this._map.unproject(nwPoint),
                se = this._map.unproject(sePoint);

            // TODO temporary hack, will be removed after refactoring projections
            // https://github.com/Leaflet/Leaflet/issues/1618
            if (!options.continuousWorld && !options.noWrap) {
                nw = nw.wrap();
                se = se.wrap();
            }

            if (!options.bounds.intersects([nw, se])) { return false; }
        }

        return true;
    },
    
    getTileUrl: function (tilePoint) {
        return L.Util.template(this.url, L.extend({
            s: '',
            m: this.options.map,
            z: tilePoint.z,
            x: tilePoint.x,
            y: tilePoint.y
        }, this.options));
    },
    
    _getZoomForUrl: function () {
        var options = this.options,
            zoom = this._map.getZoom();

        //if (options.zoomReverse) {
        //    zoom = options.maxZoom - zoom;
        //}

        return zoom; // +options.zoomOffset;
    },
    
    _getWrapTileNum: function () {
        // TODO refactor, limit is not valid for non-standard projections
        return Math.pow(2, this._getZoomForUrl());
    },
    
    _adjustTilePoint: function (tilePoint) {
        var limit = this._getWrapTileNum();

        /*
        // wrap tile coordinates
        if (!this.options.continuousWorld && !this.options.noWrap) {
            tilePoint.x = ((tilePoint.x % limit) + limit) % limit;
        }

        if (this.options.tms) {
            tilePoint.y = limit - tilePoint.y - 1;
        }
        */
        tilePoint.z = this._getZoomForUrl();
    },
    
    // ---------------------------------------
    
    isPoint: function(type) {
        return (type == 'Marker' || type == 'MultiPoint' || type == 'Point');
    },
    
    getFieldTitle: function(fields, name)
    {
        if (fields && fields.fields)
        {
            for (var rows in fields.fields) 
            { 
                var row = fields.fields[ rows];
                if (row[ 0]) {
                    var field = row[ 0];

                    if (field.name && field.title && field.name.toLowerCase() == name.toLowerCase()) {
                       return field.title;
                    }
                }
            }
        }  
                        
        return name;
    },     
    
    getItems: function(that, fields, data) 
    {
        var items = [];
        items.push( "<table>");
        for (var key in data) {
            var val = data[ key];
            //items.push( "<h4>" +that.getFieldTitle( fields, key) +"</h4>" +val + "<br>" );
            items.push( "<tr class='trlable'><td><b>" +that.getFieldTitle( fields, key) +":</b><td><td>" + val + "</td></tr>" );            
        };  
        items.push( "</table>");
        return items;
    },
            
    iconCount: function( childCount, color) 
    {
        var c = ' marker-cluster-';
        
        if (childCount < 10) {
            c += 'small';
        } else if (childCount < 100) {
            c += 'medium';
        } else {
            c += 'large';
        }

        return new L.DivIcon({ html: '<button style="background-color:' +color +';width:40px;height:40px;border-radius:20px;"><div style="margin: 0px;background-color:' +color +'"><span>' + childCount + '</span></div></button>', className: 'thrumbal', iconSize: new L.Point(40, 40) });
    },
    
    getStyle: function(val, layerStyle) 
    {
        //var that = this;
        var prior = undefined; 

        if (layerStyle)
        for (var iStyle in layerStyle.style) 
        {
            var style = layerStyle.style[ iStyle];
            var value = "" +style.value;

            if (value.length > 0 && value.indexOf("-", 1) > 0 && layerStyle.type != 'string')
            {
                var from = value.substr(0, value.indexOf("-", 1)).trim();
                var upto = value.substr(value.indexOf("-", 1) +1).trim();

                if (layerStyle.type == 'int' || layerStyle.type == 'float') 
                {
                    from = parseFloat( from);
                    upto = parseFloat( upto);
                    val = parseFloat( val);

                    if (val >= from && val <= upto) {
                        return style;
                    }
                } else {
                    if (val == from || val == upto) {
                        return style;
                    }
                }
            } else {
                if (layerStyle.type == 'int' || layerStyle.type == 'float') 
                { 
                    if (val == style.value || (prior && val > prior && val < style.value)) {
                        return style;
                    }
                } else {
                    if (val == style.value) {
                        return style;
                    }
                }
            }

            prior = style.value;
        }
    },
    
    valColor: function( c)
    {
        if (c && c.indexOf( "#") == -1)
            return '#' +c;
        else
            return c;
    },
    
    getColor: function(d, layerStyle) 
    {
        var that = this;
        
        if (layerStyle && layerStyle.style)
            {
                var style = that.getStyle( d, layerStyle); 

                if (style)
                    return that.valColor( style.color);
            }
        else    
        return d > 1000 ? '#800026' :
               d > 500  ? '#BD0026' :
               d > 200  ? '#E31A1C' :
               d > 100  ? '#FC4E2A' :
               d > 50   ? '#FD8D3C' :
               d > 20   ? '#FEB24C' :
               d > 10   ? '#FED976' :
                          '#FFEDA0';
    },
    
    style: function(feature, that, layerStyle) 
    {
        var value = feature.id; 
        
        if (layerStyle && layerStyle.field) {
            if (feature.properties[ layerStyle.field.toLowerCase()]) {
               value = feature.properties[ layerStyle.field.toLowerCase()];
            }
        }
        
        return {
            fillColor: that.getColor( value, layerStyle),
            weight: 1,
            opacity: 1,
            //zIndex: 100000 -value,
            color: 'white',
            dashArray: '',
            fillOpacity: 0.7
        };
    },        
    
    setIcon: function( url, width, height)
    {
        var userIcon = L.Icon.extend({ options: {iconUrl: url, iconSize: [width, height], iconAnchor: [ Math.round( width/2), height -1], popupAnchor: [0, -height +Math.round( width/2)]}});
        return new userIcon();
    }    
})
