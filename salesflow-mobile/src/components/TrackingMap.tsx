import React, { useMemo } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export default function TrackingMap({ locations, initialRegion, colors, routeData }: any) {
  const mapHtml = useMemo(() => {
    const center = initialRegion || { latitude: 13.0827, longitude: 80.2707 };

    const markersData = JSON.stringify(
      (locations || [])
        .map((loc: any) => ({
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
          title: loc.profiles?.username || 'Agent',
          updatedAt: (() => {
            try {
              if (!loc.updated_at) return '';
              const d = new Date(loc.updated_at);
              return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch { return ''; }
          })(),
        }))
        .filter((m: any) => !isNaN(m.lat) && !isNaN(m.lng) && m.lat !== 0 && m.lng !== 0)
    );

    const routeJson = routeData ? JSON.stringify(routeData) : 'null';

    // Build the marker icon HTML as a separate CSS-class based approach to avoid quote nesting issues
    const markerHtml = '<div class="agent-dot"></div>';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  body { margin: 0; padding: 0; background: #e5e3df; height: 100%; overflow: hidden; }
  #map { height: 100vh; width: 100vw; }
  .leaflet-control-attribution { display: none !important; }
  .agent-dot {
    width: 18px; height: 18px; border-radius: 50%;
    background: #6366f1; border: 3px solid #ffffff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  }
  .custom-popup .leaflet-popup-content-wrapper {
    background: #1a1b26; color: #f1f5f9;
    border-radius: 12px; border: 1px solid #3b3d52;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  }
  .custom-popup .leaflet-popup-tip { background: #1a1b26; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: false, fadeAnimation: true })
    .setView([${center.latitude}, ${center.longitude}], 15);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20, detectRetina: true
  }).addTo(map);

  var route = ${routeJson};
  if (route && route.length > 0) {
    var poly = L.polyline(route, { color: '#6366f1', weight: 5, opacity: 0.9 }).addTo(map);
    map.fitBounds(poly.getBounds().pad(0.15));
  }

  var markers = ${markersData};
  var mg = L.featureGroup().addTo(map);
  markers.forEach(function(m) {
    var ic = L.divIcon({
      className: '',
      html: '${markerHtml}',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -12]
    });
    L.marker([m.lat, m.lng], { icon: ic })
      .addTo(mg)
      .bindPopup(
        '<div style="text-align:center;padding:4px 8px"><b style="font-size:14px">' +
        m.title + '</b><br><span style="font-size:11px;opacity:0.7">' +
        m.updatedAt + '</span></div>',
        { className: 'custom-popup', minWidth: 120 }
      );
  });

  if (markers.length > 0 && !route) {
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 16);
    } else {
      map.fitBounds(mg.getBounds().pad(0.2));
    }
  }
</script>
</body>
</html>`;

    return html;
  }, [locations, initialRegion, routeData]);

  return (
    <View style={[styles.container, { borderColor: colors?.border || '#e2e8f0' }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        overScrollMode="never"
        startInLoadingState={true}
        androidHardwareAccelerationDisabled={false}
        renderLoading={() => (
          <View style={[styles.loader, { backgroundColor: '#e5e3df' }]}>
            <ActivityIndicator color={colors?.accent || '#6366f1'} size="large" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    overflow: 'hidden', borderRadius: 16, borderWidth: 1,
  },
  webview: { flex: 1 },
  loader: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
});
