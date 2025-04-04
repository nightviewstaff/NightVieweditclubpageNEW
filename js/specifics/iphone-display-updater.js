// iphone-display-updater.js
export function updateIPhoneDisplay(data) {
    const {
        displayName,
        logo,
        type,
        ageRestriction,
        entryPrice,
        primaryColor,
        secondaryColor,
        font,
        openingHours,
        lat,
        lon
    } = data;

    const iphoneContainer = document.querySelector(".iphone-wrapper");

    if (iphoneContainer) {
        // Club Name
        const clubName = iphoneContainer.querySelector(".club-name h1");
        clubName.textContent = displayName || "Club Name";
        clubName.style.color = primaryColor || "inherit"; // Apply primary color to club name

        // Logo
        iphoneContainer.querySelector(".logo-container img").src = logo;

        // Type Image
        iphoneContainer.querySelector("#club-type-img").src = type
            ? `../images/clubtype/${type}_icon.png`
            : "../images/default_type.png";

        // Age Restriction
        iphoneContainer.querySelector(".age-restriction").textContent =
            ageRestriction ? `${ageRestriction}+` : "18+";

        // Colors and Font
        const clubHeader = iphoneContainer.querySelector(".club-header");
        if (clubHeader) {
            clubHeader.style.backgroundColor = secondaryColor || "transparent"; // Apply secondary color to club-header
            clubHeader.style.fontFamily = font;
        }

        // Opening Hours
        iphoneContainer.querySelector(".opening-hours").textContent =
            openingHours ? `${openingHours} today` : "Closed today";

        // Map
        initMap(lat, lon, logo);
    }
}

let leafletMap = null; // This will hold your map instance
let lastCoords = {lat: null, lon: null};

function initMap(lat, lon, logoUrl) {
    if (!lat || !lon) return;

    // Skip redraw if coordinates are same
    if (leafletMap && lastCoords.lat === lat && lastCoords.lon === lon) return;

    lastCoords = {lat, lon};

    if (leafletMap) leafletMap.remove();

    leafletMap = L.map("map").setView([lat, lon], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
    }).addTo(leafletMap);

    const clubIcon = L.icon({
        iconUrl: logoUrl || "../images/nightview/logo_text.png",
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        className: "club-marker",
    });

    L.marker([lat, lon], {icon: clubIcon}).addTo(leafletMap);
}

