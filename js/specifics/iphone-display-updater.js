// iphone-display-updater.js
import {getClubSession} from "../utilities/session.js";
import { getOfferImageUrl,mainOfferImgUrl } from "./club-overview.js";
import {toTitleCase} from "../utilities/utility.js";

export async function updateIPhoneDisplay(data) {
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
        const resolvedFont = font ? `"${font}", sans-serif` : "var(--font-primary)";

        // Club Name
        const clubName = iphoneContainer.querySelector(".club-name h1");
        if (clubName) {
            clubName.textContent = toTitleCase(displayName) || "Club Name";
            clubName.style.color =
                primaryColor === "NightView Green" || !primaryColor
                    ? "var(--night-view-green)"
                    : primaryColor;
            clubName.style.fontFamily = resolvedFont;
        }

        // Club Header
        const clubHeader = iphoneContainer.querySelector(".club-header");
        if (clubHeader) {
            clubHeader.style.backgroundColor =
                secondaryColor === "NightView Black" || !secondaryColor
                    ? "var(--color-black)"
                    : secondaryColor;
            clubHeader.style.fontFamily = resolvedFont;
        }

        // Other Preview Elements That Should Use the Font
        const fontTargets = iphoneContainer.querySelectorAll(".age-restriction, .opening-hours, .offer-image h2");
        fontTargets.forEach(el => {
            el.style.fontFamily = resolvedFont;
        });

        // Logo
        iphoneContainer.querySelector(".logo-container img").src = logo;

        // Type Image
        iphoneContainer.querySelector("#club-type-img").src = type
            ? `../images/clubtype/${type}_icon.png`
            : "../images/clubtype/bar_icon.png";

        // Age Restriction
        iphoneContainer.querySelector(".age-restriction").textContent =
            ageRestriction && ageRestriction > 16 ? `${ageRestriction}+` : "Unknown age restriction";

        // Opening Hours
        iphoneContainer.querySelector(".opening-hours").textContent =
            openingHours ? `${openingHours} today` : "Closed today";

        // Offer Image
        const offerImage = iphoneContainer.querySelector(".offer-image img");
        const offerHeader = iphoneContainer.querySelector(".offer-image h2");
        const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
        const clubId = getClubSession();
        let offerUrl = await getOfferImageUrl(clubId, today); // Daily offer first
        if (!offerUrl) {
            offerUrl = mainOfferImgUrl; // Fall back to main offer
        }
        if (offerUrl) {
            offerImage.src = offerUrl;
            offerImage.style.display = "block";
            offerHeader.style.display = "block";
        }

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

