/********************************
  Ajax Traffic Panel Movement
********************************/
$(document).on({
  showPanel: function() {
    $('#info-panel').slideIn();
  },
  hidePanel: function() {
    $('#info-panel').slideOut();
  }
});

$(function (){
  var $infoPanel = $('#info-panel');

  $.fn.slideOut = function() {
    var $panel = $(this);
    var width = $panel.outerWidth();

    $(this).animate({right: -width})
      .promise().done(function() {
        $panel.hide();
      });
    return $panel;
  }
  $.fn.slideIn = function() {
    var $panel = $(this);
    var width = $panel.outerWidth();

    // reposition in case screen has resized, reveal, slide in
    return $(this).css({right: -width})
      .show()
      .animate({right: 0}, 'slow');
  }

  $('#close-tab').on('click', function() {
    $(document).trigger('hidePanel');
  });
  $('#open-tab').on('click', function() {
    $(document).trigger('showPanel');
  });
});


/********************************
  Print Ajax Request target
********************************/
$(document).on({
  'ajaxSend': function(event, jqXHR, ajaxOptions) {
    var request = decodeURIComponent(ajaxOptions.url)
    // custom format for prism syntax-highlighting
      .replace(/(\?|&)([^=]+)(=)([^&\?]*)/g, '\n\t<span class="token punctuation">$1</span><span class="token attr-name">$2</span><span class="token punctuation">$3</span><span class="token attr-value">$4</span>');

    $('#request-window').html(request);

    // TODO: why is the <pre> not ready yet?
    // activity indicator ends up top left without the timeout
    setTimeout(function() {
      $('#request-window').activity();
    }, 10);
  },
  'ajaxComplete': function(event, jqXHR, ajaxOptions) {
    $('#request-window').activity(false);
  }
});

/********************************
  Google Map
********************************/
function initializeMap() {
  var mapOptions = {
    center: new google.maps.LatLng(48.420617, -123.370871),
    zoom: 16,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    panControl: false,
    zoomControl: true,
    zoomControlOptions: {
        style: google.maps.ZoomControlStyle.LARGE,
        position: google.maps.ControlPosition.LEFT_CENTER
    }
  };
  return new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
}

/********************************
  DataBC Overlay
********************************/
function OpenDataOverlay(layers, queryLayers, map) {
  this.layers = layers;
  this.queryLayers = queryLayers;
  this.placemarks = {};

  this.yahooQuery = function(width, height, bbox) {
    var yql = 'http://query.yahooapis.com/v1/public/yql';
    var openData = [
      'openmaps.gov.bc.ca/mapserver/geodetic-survey',
      '?SERVICE=WMS',
      '&VERSION=1.1.1',
      '&SRS=EPSG:4326',
      '&INFO_FORMAT=kayml',
      '&STYLES=default',
      '&REQUEST=GetFeatureInfo',
      '&LAYERS=' + this.layers,
      '&QUERY_LAYERS=' + this.queryLayers,
      '&FEATURE_COUNT=50',
      '&RADIUS=bbox',
      //1325
      '&WIDTH=' + width,
      //888
      '&HEIGHT=' + height,
      //-123.3725880084306,48.4215814815787,-123.3596945930715,48.42863228958458
      '&bbox=' + flipLatLng(bbox)
      ].join('');

    function flipLatLng() {
      // dataBC wants long,lat  instead of lat,long
      var coords = bbox.match(/[-+]?[0-9]*\.?[0-9]+/g); // match all floats

      return coords[1] + ',' + coords[0] + ',' + coords[3] + ',' + coords[2];
    }

    openData = encodeURIComponent(openData);

    return [
      yql,
      '?format=json',
      '&q=SELECT * ',
      'FROM xml ',
      'WHERE url="' + openData + '"'
    ].join('');
  }

}
function getFeatures(map, width, height, bbox) {
  var self = this;
  var url = this.yahooQuery(width, height, bbox);

  $.getJSON(url, function(data) {
    var kml = data.query.results.kml;
    var placemarks = kml.Document.Folder && kml.Document.Folder.Placemark;
    var styles = {};

    $.each(kml.Document.Style, function(i, val) {
      styles['#' + val.id] = {
        icon: val.IconStyle.Icon.href,
        label: val.BalloonStyle.text
      }
    });

    // create human readable request uri
    $('#prettyprint-window').html(prettyPrint(kml, {
      maxDepth: 3
    }));

    $.each(placemarks, function(i, val) {
      var style = styles[val.styleUrl];

      if(!self.placemarks.hasOwnProperty(val.name)) {
        var marker = new google.maps.Marker({
          map: map,
          position: latlngFromString(val.Point.coordinates),
          title: 'marker ' + val.name,
          icon: style.icon,
          label: buildLabel(style.label, val.ExtendedData.Data)
        });
        google.maps.event.addListener(marker, 'click', function() {
          map.infowindow.setContent(marker.label);
          map.infowindow.open(map, marker);
        });
        self.placemarks[val.name] = marker;
      }
    });

    function latlngFromString(str) {
      // dataBC uses 'long,lat,height'
      var coords = str.match(/[-+]?[0-9]*\.?[0-9]+/g); // match all floats

      return new google.maps.LatLng(parseFloat(coords[1]), parseFloat(coords[0]));
    }
    function buildLabel(template, data){
      var label = template;

      $.each(data, function(i, attr) {
        var re = new RegExp('\\$\\[' + attr.name + '\\]', 'gi');
        label = label.replace(re, attr.value);
      });

      return label
    }
  });
}
OpenDataOverlay.prototype.getFeatures = $.debounce( 1000, getFeatures);

$(function() {
  map = initializeMap();
  var geodetics = new OpenDataOverlay('MASCOT_GEODETIC_CONTROL_DETAILS', 'MASCOT_GEODETIC_CONTROL_DETAILS', map);
  map.infowindow = new google.maps.InfoWindow({});

  google.maps.event.addListener(map, 'bounds_changed', function() {
    var bbox = this.getBounds().toUrlValue();
    var $map = $(this.getDiv());
    var width = $map.width();
    var height = $map.height();

    geodetics.getFeatures(map, width, height, bbox);
  });
  google.maps.event.addListener(map, 'click', function() {
    map.infowindow.close();
  });

  $('#myModal').modal().on('hidden', function () {
    $(document).trigger('showPanel');
  })
})
