



// Initialize the map
function initMap(lat, lon, logoUrl) {
    if (!lat || !lon) {
        console.warn("Invalid location data");
        return;
    }
    const map = L.map('map').setView([lat, lon], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const clubIcon = L.icon({
        iconUrl: logoUrl || '../images/nightview/logo_text.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        className: "club-marker"
    });
    L.marker([lat, lon], {icon: clubIcon}).addTo(map);
}