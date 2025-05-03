import {
    analytics,
    collection,
    db,
    doc,
    getDocs,
    getDownloadURL,
    logEvent,
    ref,
    serverTimestamp,
    setDoc,
    storage,
    uploadImageToFirestore
} from "../api/firebase-api.js";
import {CLUB_TYPES_ENGLISH, databaseCollections, databaseStorage, days} from "../utilities/constants.js";
import {getClubs, setClubDataCache} from "../utilities/global.js";
import {getClubSession, getSession} from "../utilities/session.js";
import {updateIPhoneDisplay} from "./iphone-display-updater.js";
import {FontSelector} from "../utilities/fontselector.js";
import {init} from "../utilities/init.js";
import {convertToWebP, getTodayKey, toTitleCase} from "../utilities/utility.js";

export let mainOfferImgUrl;
let localClubData; // Local copy of the specific club’s data, initialized later
let localOfferImages = {};

let originalDbData;
let originalLogoUrl;
let originalMainOfferImgUrl;
let pendingLogoBlob = null;
let pendingLogoFilename = null;


// DOMContentLoaded event listener for initial setup
document.addEventListener("DOMContentLoaded", async () => {
    await init();
    const uid = getSession().uid;
    const role = getSession().role;
    if (uid && role) {
        const nav = document.querySelector("nav-bar");
        if (nav && typeof nav.setUser === "function") {
            nav.setUser({ uid }, role);
        }
        // Wait for cache initialization if not ready
        if (!getClubs()) {
            await new Promise(resolve => window.addEventListener('dataInitialized', resolve, { once: true }));
        }
        const storedClubId = getClubSession();
        if (storedClubId) {
            loadData({ uid, role }, storedClubId);
        }
    } else {
        window.location.href = "/NightVieweditclubpage/html/login.html";
    }
});

// Log page view event for analytics
logEvent(analytics, "page_view");

// Utility function to fetch a storage URL with a fallback
function fetchStorageUrl(path, fallbackUrl = "") {
    const storageRef = ref(storage, path);
    return getDownloadURL(storageRef)
        .then((url) => url)
        .catch((error) => {
            console.warn(`Could not fetch ${path}, using fallback`, error);
            return fallbackUrl;
        });
}

// Main function to fetch and display club data
async function loadData(user, selectedClubId) {
    console.log("loadData called with user:", user, "selectedClubId:", selectedClubId);
    if (selectedClubId === "add-new") {
        prepareNewClubForm();
        return;
    }

    try {
        let clubs = getClubs();
        if (!clubs) {
            // Fallback to direct fetch if cache isn't initialized (startup only)
            const querySnapshot = await getDocs(collection(db, "club_data"));
            clubs = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
            }));
            setClubDataCache(clubs); // Only called here at startup
            console.log("Fetched fresh clubDataCache:", clubs);
        } else {
            console.log("Using cached clubData:", clubs);
        }

        const allowedClubs = clubs.filter(club => {
            if (user.role === "admin") return true;
            if (user.role === "owner" && Array.isArray(club.owners) && club.owners.includes(user.uid))
                return true;
            if (user.role === "staff") return true;

            return false;
        });

        if (allowedClubs.length === 0) {
            console.log("No clubs accessible for this user.");
            alert("You do not have permission to view any clubs.");
            return;
        }

        const club = allowedClubs.find(club => club.id === selectedClubId);
        if (!club) {
            console.log(`Club with ID ${selectedClubId} not found or not authorized.`);
            alert("You do not have permission to view this club or it doesn’t exist.");
            return;
        }

        // Initialize localClubData as a deep copy of the specific club
        localClubData = { ...club, opening_hours: { ...(club.opening_hours || {}) } };

        mainOfferImgUrl = club.main_offer_img
            ? await fetchStorageUrl(`main_offers/${club.main_offer_img}`, null)
            : null;

        // Populate DOM directly
        const clubData = {
            name: club.name || "Unknown Club",
            logo: await fetchStorageUrl(`club_logos/${club.logo}`, "../images/default_logo.png"),
            ageRestriction: club.age_restriction && club.age_restriction >= 16
                ? `${club.age_restriction}+`
                : "Unknown age restriction",
            openingHours: formatOpeningHours(club.opening_hours),
            distance: "300 m",
            isFavorite: true,
            typeOfClub: club.type_of_club || "unknown",
        };

        originalDbData = { ...club };
        originalLogoUrl = clubData.logo;
        originalMainOfferImgUrl = mainOfferImgUrl;

        // Header Section
        const clubNameH1 = document.querySelector(".header-title");
        if (clubNameH1) clubNameH1.textContent = clubData.name;

        const clubLogoImg = document.getElementById("clubLogoImg");
        if (clubLogoImg) {
            clubLogoImg.src = clubData.logo || ""; // Set to empty string if no logo
            clubLogoImg.addEventListener("click", () => {
                if (!clubData.logo || isDefaultLogo(clubLogoImg.src)) {
                    uploadNewLogo(selectedClubId, clubLogoImg);
                } else {
                    showLogoPopup(selectedClubId, clubLogoImg);
                }
            });
        }

        const clubTypeImg = document.getElementById("clubTypeImg");
        if (clubTypeImg) {
            clubTypeImg.src = club.type_of_club
                ? `../images/clubtype/${club.type_of_club}_icon.png`
                : "../images/default_type.png";
        }

        // Basic Info Section
        const clubNameInput = document.getElementById("clubNameInput");
        if (clubNameInput) clubNameInput.value = clubData.name;

        const clubDisplayName = document.getElementById("clubDisplayName");
        if (clubDisplayName) clubDisplayName.value = club.displayName || clubData.name;

        const typeOfClubSelect = document.getElementById("typeOfClubSelect");
        if (typeOfClubSelect) {
            typeOfClubSelect.innerHTML = "";
            Object.entries(CLUB_TYPES_ENGLISH).forEach(([dbValue, displayLabel]) => {
                const option = document.createElement("option");
                option.value = dbValue;
                option.textContent = displayLabel;
                typeOfClubSelect.appendChild(option);
            });
            typeOfClubSelect.value = club.type_of_club || "";
        }

        // Location Section
        const lat = document.getElementById("lat");
        if (lat) lat.value = club.lat ?? "";

        const lon = document.getElementById("lon");
        if (lon) lon.value = club.lon ?? "";

        if (Array.isArray(club.corners)) {
            club.corners.forEach((corner, index) => {
                const latInput = document.getElementById(`corner${index + 1}-lat`);
                const lonInput = document.getElementById(`corner${index + 1}-lon`);
                if (latInput) latInput.value = corner._lat ?? "";
                if (lonInput) lonInput.value = corner._long ?? "";
            });
        } else {
            for (let i = 1; i <= 4; i++) {
                const latInput = document.getElementById(`corner${i}-lat`);
                const lonInput = document.getElementById(`corner${i}-lon`);
                if (latInput) latInput.value = "";
                if (lonInput) lonInput.value = "";
            }
        }

        // Details Section
        const maxVisitors = document.getElementById("maxVisitors");
        if (maxVisitors) maxVisitors.value = club.total_possible_amount_of_visitors ?? "";

        const entryPrice = document.getElementById("entryPrice");
        if (entryPrice) entryPrice.value = club.entry_price ?? "0";

        const primaryColor = document.getElementById("primaryColor");
        if (primaryColor) primaryColor.value = club.primary_color ?? "NightView Green";

        const secondaryColor = document.getElementById("secondaryColor");
        if (secondaryColor) secondaryColor.value = club.secondary_color ?? "NightView Black";

        const fontSelect = document.getElementById("font");
        if (fontSelect) {
            const fontSelector = new FontSelector("fontFieldItem", (selectedFont) => {
                localClubData.font = selectedFont;
                syncAndUpdatePreview();
            });
            fontSelect.value = club.font || "NightView Font";
        }

        // Weekdays Section
        const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        days.forEach((day) => {
            const hoursElement = document.getElementById(`${day}-hours`);
            const ageElement = document.getElementById(`${day}-age`);
            const offerButton = document.getElementById(`${day}-offer`);

            const dayHours = club.opening_hours?.[day];
            if (hoursElement) {
                hoursElement.value = dayHours && dayHours.open && dayHours.close
                    ? `${dayHours.open} - ${dayHours.close}`
                    : "Closed";
            }

            const dayAgeRestriction = dayHours?.ageRestriction ?? club.age_restriction;
            if (ageElement) {
                ageElement.value = dayAgeRestriction && dayAgeRestriction >= 18
                    ? `${dayAgeRestriction}+`
                    : "Not set";
            }

            const hasSpecificOffer = !!club.opening_hours?.[day]?.daily_offer;
            const hasMainOffer = !!mainOfferImgUrl;
            if (offerButton) {
                offerButton.textContent = hasSpecificOffer ? "Specific Offer" : hasMainOffer ? "Main Offer" : "Add Offer";
                offerButton.classList.toggle("has-offer", hasSpecificOffer || hasMainOffer);
                // Remove existing listener to prevent duplicates
                offerButton.removeEventListener("click", offerButton._clickHandler);
                offerButton._clickHandler = () => handleOfferAction(day, selectedClubId, offerButton);
                offerButton.addEventListener("click", offerButton._clickHandler);
            }
        });
    } catch (error) {
        console.error("Error loading club data:", error);
        alert("An error occurred while loading data.");
    }


    // Add event listener for "Add Image" button
    //TODO Needs to be able to
    const addImageBtn = document.getElementById("addImageBtn");
    if (addImageBtn) {
        addImageBtn.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.click();

            input.onchange = async () => {
                const file = input.files[0];
                if (!file) return;

                const imageName = prompt("Write the name of the beverage.", file.name.replace(/\.[^/.]+$/, ""));
                if (!imageName) return;

                const tempUrl = URL.createObjectURL(file);

                const menuImage = {
                    file: file,
                    previewUrl: tempUrl,
                    name: imageName // ✅ store name
                };

                if (!window.menuImages) window.menuImages = [];
                window.menuImages.push(menuImage);
                updateImagesSection(getClubSession());
            };

        });
    }

    updateImagesSection(selectedClubId);

    setupLivePreviewBindings();
    bindLeftInputs();
}

function isDefaultLogo(src) {
    return src.includes("default_logo.png") || !src || src.trim() === "";
}


function showLogoPopup(clubId, logoImgElement) {
    const popup = document.createElement("div");
    popup.className = "offer-popup";

    const header = document.createElement("h3");
    header.className = "popup-header";
    header.textContent = "Club Logo";
    popup.appendChild(header);

    const img = document.createElement("img");
    img.src = logoImgElement.src;
    img.alt = "Club Logo";
    img.style.maxWidth = "100%";
    img.style.maxHeight = "80vh";
    popup.appendChild(img);

    const uploadButton = document.createElement("button");
    uploadButton.textContent = "Change Logo";
    uploadButton.style.backgroundColor = "var(--night-view-green)";
    uploadButton.addEventListener("click", () => uploadNewLogo(clubId, logoImgElement, popup));
    popup.appendChild(uploadButton);

    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    popup.style.zIndex = "1000";
    document.body.appendChild(popup);

    // const closePopup = (e) => {
    //     if (!_popup.contains(e.target)) {
    //         popup.remove();
    //         document.removeEventListener("click", closePopup);
    //     }
    // };
    // setTimeout(() => document.addEventListener("click", closePopup), 0);

    syncAndUpdatePreview();
}

function resetData(clubId) {
    // Restore local variables to original state
    localClubData = { ...originalDbData, opening_hours: { ...(originalDbData.opening_hours || {}) } };
    mainOfferImgUrl = originalMainOfferImgUrl;
    localOfferImages = {};

    // Reconstruct clubData with original values
    const clubData = {
        name: originalDbData.name || "Unknown Club",
        logo: originalLogoUrl,
        ageRestriction: originalDbData.age_restriction && originalDbData.age_restriction >= 16
            ? `${originalDbData.age_restriction}+`
            : "Unknown age restriction",
        openingHours: formatOpeningHours(originalDbData.opening_hours),
        distance: "300 m",
        isFavorite: true,
        typeOfClub: originalDbData.type_of_club || "unknown",
    };

    // Populate DOM (similar to loadData, but using stored data)
    const clubNameH1 = document.querySelector(".header-title");
    if (clubNameH1) clubNameH1.textContent = clubData.name;

    const clubLogoImg = document.getElementById("clubLogoImg");
    if (clubLogoImg) {
        clubLogoImg.src = clubData.logo || ""; // Set to empty string if no logo
        clubLogoImg.addEventListener("click", () => {
            if (!clubData.logo || isDefaultLogo(clubLogoImg.src)) {
                uploadNewLogo(selectedClubId, clubLogoImg);
            } else {
                showLogoPopup(selectedClubId, clubLogoImg);
            }
        });
    }
    const clubTypeImg = document.getElementById("clubTypeImg");
    if (clubTypeImg) {
        clubTypeImg.src = originalDbData.type_of_club
            ? `../images/clubtype/${originalDbData.type_of_club}_icon.png`
            : "../images/clubtype/bar_icon.png";
    }

    const clubNameInput = document.getElementById("clubNameInput");
    if (clubNameInput) clubNameInput.value = clubData.name;

    const clubDisplayName = document.getElementById("clubDisplayName");
    if (clubDisplayName) clubDisplayName.value = originalDbData.displayName || clubData.name;

    const typeOfClubSelect = document.getElementById("typeOfClubSelect");
    if (typeOfClubSelect) {
        typeOfClubSelect.value = originalDbData.type_of_club || "";
    }

    const lat = document.getElementById("lat");
    if (lat) lat.value = originalDbData.lat ?? "";

    const lon = document.getElementById("lon");
    if (lon) lon.value = originalDbData.lon ?? "";

    if (Array.isArray(originalDbData.corners)) {
        originalDbData.corners.forEach((corner, index) => {
            const latInput = document.getElementById(`corner${index + 1}-lat`);
            const lonInput = document.getElementById(`corner${index + 1}-lon`);
            if (latInput) latInput.value = corner._lat ?? "";
            if (lonInput) lonInput.value = corner._long ?? "";
        });
    } else {
        for (let i = 1; i <= 4; i++) {
            const latInput = document.getElementById(`corner${i}-lat`);
            const lonInput = document.getElementById(`corner${i}-lon`);
            if (latInput) latInput.value = "";
            if (lonInput) lonInput.value = "";
        }
    }

    const maxVisitors = document.getElementById("maxVisitors");
    if (maxVisitors) maxVisitors.value = originalDbData.total_possible_amount_of_visitors ?? "";

    const entryPrice = document.getElementById("entryPrice");
    if (entryPrice) entryPrice.value = originalDbData.entry_price ?? "0";

    const primaryColor = document.getElementById("primaryColor");
    if (primaryColor) primaryColor.value = originalDbData.primary_color ?? "NightView Green";

    const secondaryColor = document.getElementById("secondaryColor");
    if (secondaryColor) secondaryColor.value = originalDbData.secondary_color ?? "NightView Black";

    const fontSelect = document.getElementById("font");
    if (fontSelect) fontSelect.value = originalDbData.font || "NightView Font";

    // Reset weekdays section
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    days.forEach((day) => {
        const hoursElement = document.getElementById(`${day}-hours`);
        const ageElement = document.getElementById(`${day}-age`);
        const offerButton = document.getElementById(`${day}-offer`);

        const dayHours = originalDbData.opening_hours?.[day];
        if (hoursElement) {
            hoursElement.value = dayHours && dayHours.open && dayHours.close
                ? `${dayHours.open} - ${dayHours.close}`
                : "Closed";
        }

        const dayAgeRestriction = dayHours?.ageRestriction ?? originalDbData.age_restriction;
        if (ageElement) {
            ageElement.value = dayAgeRestriction && dayAgeRestriction >= 18
                ? `${dayAgeRestriction}+`
                : "Not set";
        }

        const hasSpecificOffer = !!originalDbData.opening_hours?.[day]?.daily_offer;
        const hasMainOffer = !!mainOfferImgUrl;
        days.forEach((day) => {
            const hoursElement = document.getElementById(`${day}-hours`);
            const ageElement = document.getElementById(`${day}-age`);
            const offerButton = document.getElementById(`${day}-offer`);

            const dayHours = originalDbData.opening_hours?.[day];
            if (hoursElement) {
                hoursElement.value = dayHours && dayHours.open && dayHours.close
                    ? `${dayHours.open} - ${dayHours.close}`
                    : "Closed";
            }

            const dayAgeRestriction = dayHours?.ageRestriction ?? originalDbData.age_restriction;
            if (ageElement) {
                ageElement.value = dayAgeRestriction && dayAgeRestriction >= 18
                    ? `${dayAgeRestriction}+`
                    : "Not set";
            }

            const hasSpecificOffer = !!originalDbData.opening_hours?.[day]?.daily_offer;
            const hasMainOffer = !!mainOfferImgUrl;
            if (offerButton) {
                offerButton.textContent = hasSpecificOffer ? "Specific Offer" : hasMainOffer ? "Main Offer" : "Add Offer";
                offerButton.classList.toggle("has-offer", hasSpecificOffer || hasMainOffer);
                // Remove existing listener to prevent duplicates
                offerButton.removeEventListener("click", offerButton._clickHandler);
                offerButton._clickHandler = () => handleOfferAction(day, clubId, offerButton);
                offerButton.addEventListener("click", offerButton._clickHandler);
            }
        });
    });

    updateImagesSection(clubId);
    syncAndUpdatePreview();
}

async function uploadNewLogo(clubId, logoImgElement, popup) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        try {
            pendingLogoFilename = await getAvailableLogoName(localClubData.name);
            pendingLogoBlob = await convertToWebP(file);

            const tempUrl = URL.createObjectURL(pendingLogoBlob);
            logoImgElement.src = tempUrl;
            localClubData.logo = tempUrl; // ✅ use the preview URL to trigger iPhone update

            syncClubDataCache(clubId);
            updateImagesSection(clubId);
            if (popup) popup.remove();
            syncAndUpdatePreview(); // ✅ triggers iPhone logo refresh
        } catch (error) {
            console.error("❌ Error preparing logo for deferred upload:", error);
            alert("Failed to prepare logo.");
        }
    };
}


// Utility function to format opening hours
function formatOpeningHours(openingHours) {
    if (!openingHours || typeof openingHours !== "object") return "Not set";
    return Object.entries(openingHours)
        .map(([day, hours]) =>
            hours && hours.open && hours.close
                ? `${day}: ${hours.open} - ${hours.close}`
                : `${day}: Closed`
        )
        .join(", ");
}

// Centralize sync and update logic
function syncAndUpdatePreview() {
    const today = getTodayKey();

    // Sync basic club data with DOM
    localClubData.name = document.getElementById("clubNameInput").value;
    const nameValue = document.getElementById("clubNameInput").value.trim();
    const displayNameValue = document.getElementById("clubDisplayName").value.trim();
    localClubData.displayName = nameValue === displayNameValue ? null : displayNameValue;

    localClubData.type_of_club = document.getElementById("typeOfClubSelect").value;
    localClubData.entry_price = parseFloat(document.getElementById("entryPrice").value || "0");
    localClubData.primary_color = document.getElementById("primaryColor").value;
    localClubData.secondary_color = document.getElementById("secondaryColor").value;
    localClubData.font = document.getElementById("font").value;
    localClubData.lat = parseFloat(document.getElementById("lat").value);
    localClubData.lon = parseFloat(document.getElementById("lon").value);

    // Get today's data from DOM for UI preview only
    const hoursValue = document.getElementById(`${today}-hours`).value;
    let open, close;
    if (hoursValue === "Closed") {
        open = "00:00";
        close = "00:00";
    } else {
        [open, close] = hoursValue.split(" - ");
    }

    const ageValue = document.getElementById(`${today}-age`).value.replace("+", "");
    const ageRestriction = ageValue ? parseInt(ageValue) : localClubData.age_restriction;
    const displayNameToUse = localClubData.displayName || toTitleCase(localClubData.name);

    // Update iPhone preview for today
    updateIPhoneDisplay({
        displayName: displayNameToUse,
        logo: localClubData.logo,
        type: localClubData.type_of_club,
        ageRestriction: ageRestriction >= 16 ? ageRestriction : localClubData.age_restriction,
        entryPrice: localClubData.entry_price,
        primaryColor: localClubData.primary_color,
        secondaryColor: localClubData.secondary_color,
        font: localClubData.font,
        openingHours: hoursValue,
        lat: localClubData.lat,
        lon: localClubData.lon
    });
}

function setupLivePreviewBindings() {
    const today = getTodayKey();
    const inputs = {
        displayName: document.getElementById("clubDisplayName"),
        logo: document.getElementById("clubLogoImg"),
        type: document.getElementById("typeOfClubSelect"),
        maxVisitors: document.getElementById("maxVisitors"),
        entryPrice: document.getElementById("entryPrice"),
        primaryColor: document.getElementById("primaryColor"),
        secondaryColor: document.getElementById("secondaryColor"),
        font: document.getElementById("font"),
        lat: document.getElementById("lat"),
        lon: document.getElementById("lon")
    };

    Object.values(inputs).forEach((input) => {
        if (input) {
            const eventType = input.tagName === "SELECT" ? "change" : "input";
            input.addEventListener(eventType, syncAndUpdatePreview);
        }
    });

    // Add event listeners for today's age and hours
    const hoursElem = document.getElementById(`${today}-hours`);
    if (hoursElem) {
        hoursElem.addEventListener("input", syncAndUpdatePreview);
    }
    const ageElem = document.getElementById(`${today}-age`);
    if (ageElem) {
        ageElem.addEventListener("input", syncAndUpdatePreview);
    }

    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    days.forEach((day) => {
        const hoursElement = document.getElementById(`${day}-hours`);
        const hoursContainer = hoursElement?.parentElement;
        if (hoursContainer) {
            hoursContainer.addEventListener("click", () => {
                showTimePicker(day, hoursElement, (day, newHours) => {
                    hoursElement.value = newHours;
                    if (day === today) {
                        hoursElement.dispatchEvent(new Event("input"));
                    }
                });
            });
        }

        const ageElement = document.getElementById(`${day}-age`);
        const ageContainer = ageElement?.parentElement;
        if (ageContainer) {
            ageContainer.setAttribute("tabindex", "0");
            const openAgePicker = () => {
                showAgePicker(day, ageElement, (day, newAge) => {
                    const displayAge = newAge < 18 ? "Not set" : `${newAge}+`;
                    ageElement.value = displayAge;
                    if (day === today) {
                        ageElement.dispatchEvent(new Event("input"));
                    }
                });
            };
            ageContainer.addEventListener("click", openAgePicker);
            ageContainer.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openAgePicker();
                }
            });
        }
    });

    syncAndUpdatePreview(); // Initial update
}

function bindLeftInputs() {
    const nameInput = document.getElementById("clubNameInput");
    if (nameInput) {
        nameInput.addEventListener("input", () => {
            document.querySelector(".header-title").textContent = nameInput.value;
            syncAndUpdatePreview();
        });
    }

    const typeSelect = document.getElementById("typeOfClubSelect");
    if (typeSelect) {
        typeSelect.addEventListener("change", () => {
            const img = document.getElementById("clubTypeImg");
            if (img) {
                img.src = typeSelect.value
                    ? `../images/clubtype/${typeSelect.value}_icon.png`
                    : "../images/default_type.png";
            }
            syncAndUpdatePreview();
        });
    }

    const primaryColor = document.getElementById("primaryColor");
    if (primaryColor) {
        primaryColor.addEventListener("click", () => {
            showColorPicker(primaryColor, (color) => {
                primaryColor.value = color;
                syncAndUpdatePreview();
            });
        });
    }

    const secondaryColor = document.getElementById("secondaryColor");
    if (secondaryColor) {
        secondaryColor.addEventListener("click", () => {
            showColorPicker(secondaryColor, (color) => {
                secondaryColor.value = color;
                syncAndUpdatePreview();
            });
        });
    }
}

function showColorPicker(inputElement, onColorSelect) {
    const existingPopup = document.querySelector(".color-picker-popup");
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement("div");
    popup.className = "color-picker-popup";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = inputElement.value || "#000000";
    popup.appendChild(colorInput);

    const rect = inputElement.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(popup);

    requestAnimationFrame(() => colorInput.click());

    colorInput.addEventListener("input", () => {
        inputElement.value = colorInput.value;
        onColorSelect(colorInput.value);
    });

    const closePopup = (e) => {
        if (!popup.contains(e.target) && e.target !== inputElement) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}

function showTimePicker(day, hoursElement, onTimeSelect) {
    const existingPopup = document.querySelector(".time-picker-popup");
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement("div");
    popup.className = "time-picker-popup";
    popup.setAttribute("tabindex", "0");

    const header = document.createElement("h3");
    header.className = "popup-header";
    header.textContent = `Opening Hours ${day.charAt(0).toUpperCase() + day.slice(1)}`;
    popup.appendChild(header);

    const openLabel = document.createElement("label");
    openLabel.textContent = "Open Time:";
    const openInput = document.createElement("input");
    openInput.type = "time";
    openInput.value = hoursElement.value.split(" - ")[0] || "";
    popup.appendChild(openLabel);
    popup.appendChild(openInput);


    const closeLabel = document.createElement("label");
    closeLabel.textContent = "Close Time:";
    const closeInput = document.createElement("input");
    closeInput.type = "time";
    closeInput.value = hoursElement.value.split(" - ")[1] || "";
    popup.appendChild(closeLabel);
    popup.appendChild(closeInput);


    // TODO Not workining.
    const setupAutoColon = (input) => {
        input.addEventListener("input", () => {
            if (/^\d{2}$/.test(input.value)) {
                input.value = `${input.value}:00`;
                input.setSelectionRange(3, 3); // cursor after colon
            }
        });
    };
    setupAutoColon(openInput);
    setupAutoColon(closeInput);


    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.addEventListener("click", () => {
        const openTime = openInput.value;
        const closeTime = closeInput.value;
        const newHours = openTime && closeTime ? `${openTime} - ${closeTime}` : "Closed";
        hoursElement.value = newHours;
        onTimeSelect(day, newHours);
        popup.remove();
    });
    popup.appendChild(saveButton);

    popup.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveButton.click();
        }
    });

    const rect = hoursElement.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;
    document.body.appendChild(popup);
    requestAnimationFrame(() => {
        openInput.focus(); // Focus the open time input field
    });

    const closePopup = (e) => {
        if (!popup.contains(e.target) && e.target !== hoursElement) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}


function showAgePicker(day, ageElement, onAgeSelect) {
    const existingPopup = document.querySelector(".age-picker-popup");
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement("div");
    popup.className = "age-picker-popup";
    popup.setAttribute("tabindex", "0");

    const header = document.createElement("h3");
    header.className = "popup-header";
    header.textContent = `Age Restriction ${day.charAt(0).toUpperCase() + day.slice(1)}`;
    popup.appendChild(header);

    const ageLabel = document.createElement("label");
    ageLabel.textContent = "Age Limit:";
    const ageInput = document.createElement("input");
    ageInput.type = "number";
    ageInput.min = 16;
    ageInput.max = 35;
    const currentAge = parseInt(ageElement.value.replace("+", ""));
    ageInput.value = ageElement.value === "Not set" || isNaN(currentAge) ? "" : currentAge;
    popup.appendChild(ageLabel);
    popup.appendChild(ageInput);

    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.addEventListener("click", () => {
        let newAge = parseInt(ageInput.value);
        if (isNaN(newAge) || newAge < 16 || newAge > 35) {
            alert("Please enter an age between 16 and 35.");
            return;
        }
        onAgeSelect(day, newAge);
        popup.remove();
    });
    popup.appendChild(saveButton);

    popup.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveButton.click();
        }
    });

    const rect = ageElement.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;
    document.body.appendChild(popup);
    requestAnimationFrame(() => {
        ageInput.focus(); // Focus the numeric age input field
    });


    const closePopup = (e) => {
        if (!popup.contains(e.target) && e.target !== ageElement) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}

function showOfferPopup(day, clubId, offerButton) {
    getOfferImageUrl(clubId, day).then(url =>
        showImagePopup(clubId, day, url || "../images/default_offer.png", offerButton)
    );
}

async function handleOfferAction(day, clubId, offerButton) {
    const hasSpecificOffer = !!localClubData?.opening_hours?.[day]?.daily_offer;
    const hasMainOffer = !!mainOfferImgUrl;
    console.log(localClubData);
    if (hasSpecificOffer || hasMainOffer) {
        showOfferPopup(day, clubId, offerButton);
    } else {
        uploadSpecificOffer(day, clubId, offerButton, null);
    }
}

function uploadSpecificOffer(day, clubId, offerButton, popup) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.click();
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const blob = await convertToWebP(file); // ensure you convert to a Blob early
        const previewUrl = URL.createObjectURL(blob);

        offerButton.textContent = "Uploading...";
        offerButton.disabled = true;

        try {
            const uploadedFileName = file.name;

            if (!localClubData.opening_hours[day]) {
                localClubData.opening_hours[day] = {};
            }

            localOfferImages[day] = {blob, previewUrl};
            localClubData.opening_hours[day] = {
                ...(localClubData.opening_hours[day] || {}),
                daily_offer: `${day}_offer.webp`
            };
            syncClubDataCache(clubId);
            offerButton.textContent = "Specific Offer";
            offerButton.classList.add("has-offer");
            updateImagesSection(clubId);
            if (popup) popup.remove();
            // showOfferPopup(day, clubId, offerButton);
            if (day === getTodayKey()) syncAndUpdatePreview();
        } catch (error) {
            console.error(`Error processing specific offer for ${day}:`, error);
            alert(`Failed to process specific offer for ${day}.`);
        } finally {
            offerButton.disabled = false;
        }
    };
}

export async function getOfferImageUrl(clubId, day) {
    const clubData = getClubs().find(club => club.id === clubId) || localClubData;
    const dayData = clubData?.opening_hours?.[day];

    const offerFileName = dayData?.daily_offer ?? null;
    if (offerFileName) {
        if (localOfferImages[day]) return localOfferImages[day];

        // const storagePath = `daily_offers/${offerFileName}`;
        const storagePath = `${databaseStorage.clubImages}/${databaseStorage.clubOffers}/${offerFileName}`;
        //TODO CHANGED PATH
        try {
            return await getDownloadURL(ref(storage, storagePath));
        } catch (error) {
            console.warn(`No offer image found for ${day}:`, error);
            return null;
        }
    }
    return null;
}

function syncClubDataCache(clubId) {
    // No need to update the global cache here since setClubDataCache is only called at startup
    // This function can be a placeholder or removed if it’s only used to sync localClubData with DOM changes
    // For now, we’ll assume it’s called to ensure localClubData reflects the latest changes
    const clubs = getClubs();
    const index = clubs.findIndex(club => club.id === clubId);
    if (index !== -1) {
        // Optionally update localClubData from the cache if needed, but typically changes flow TO localClubData
        // Since we’re not updating the cache, this might not be necessary here
        console.log("Local club data is in sync with DOM changes.");
    }
}
// Helper function to compare arrays of corner coordinates
function arraysEqual(arr1, arr2) {
    if (!arr1 || !arr2) return arr1 === arr2;
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i]._lat !== arr2[i]._lat || arr1[i]._long !== arr2[i]._long) {
            return false;
        }
    }
    return true;
}

// Helper function to detect changes between original and local data
function getChanges() {
    const changes = [];

    // Basic Info
    if (localClubData.name !== originalDbData.name) {
        changes.push({ field: "Name", oldValue: originalDbData.name, newValue: localClubData.name });
    }
    if (localClubData.displayName !== originalDbData.displayName) {
        changes.push({ field: "Display Name", oldValue: originalDbData.displayName, newValue: localClubData.displayName });
    }
    if (localClubData.type_of_club !== originalDbData.type_of_club) {
        changes.push({ field: "Type of Club", oldValue: originalDbData.type_of_club, newValue: localClubData.type_of_club });
    }

    // Location
    if (localClubData.lat !== originalDbData.lat) {
        changes.push({ field: "Latitude", oldValue: originalDbData.lat, newValue: localClubData.lat });
    }
    if (localClubData.lon !== originalDbData.lon) {
        changes.push({ field: "Longitude", oldValue: originalDbData.lon, newValue: localClubData.lon });
    }
    if (!arraysEqual(localClubData.corners, originalDbData.corners)) {
        changes.push({ field: "Corners", change: "Updated" });
    }

    // Details
    if (localClubData.total_possible_amount_of_visitors !== originalDbData.total_possible_amount_of_visitors) {
        changes.push({ field: "Max Visitors", oldValue: originalDbData.total_possible_amount_of_visitors, newValue: localClubData.total_possible_amount_of_visitors });
    }
    if (localClubData.entry_price !== originalDbData.entry_price) {
        changes.push({ field: "Entry Price", oldValue: originalDbData.entry_price, newValue: localClubData.entry_price });
    }
    if (localClubData.primary_color !== originalDbData.primary_color) {
        changes.push({ field: "Primary Color", oldValue: originalDbData.primary_color, newValue: localClubData.primary_color });
    }
    if (localClubData.secondary_color !== originalDbData.secondary_color) {
        changes.push({ field: "Secondary Color", oldValue: originalDbData.secondary_color, newValue: localClubData.secondary_color });
    }
    if (localClubData.font !== originalDbData.font) {
        changes.push({ field: "Font", oldValue: originalDbData.font, newValue: localClubData.font });
    }

    // Logo
    if (localClubData.logo !== originalLogoUrl) {
        changes.push({ field: "Logo", change: "Updated" });
    }

    // Opening Hours
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    days.forEach(day => {
        const originalDay = originalDbData.opening_hours?.[day] || {};
        const localDay = localClubData.opening_hours?.[day] || {};

        // Hours
        if (localDay.open !== originalDay.open || localDay.close !== originalDay.close) {
            const oldHours = originalDay.open && originalDay.close ? `${originalDay.open} - ${originalDay.close}` : "Closed";
            const newHours = localDay.open && localDay.close ? `${localDay.open} - ${localDay.close}` : "Closed";
            changes.push({ field: `${day.charAt(0).toUpperCase() + day.slice(1)} Hours`, oldValue: oldHours, newValue: newHours });
        }

        // Age Restriction
        if (localDay.ageRestriction !== originalDay.ageRestriction) {
            const oldAge = originalDay.ageRestriction ? `${originalDay.ageRestriction}+` : "Not set";
            const newAge = localDay.ageRestriction ? `${localDay.ageRestriction}+` : "Not set";
            changes.push({ field: `${day.charAt(0).toUpperCase() + day.slice(1)} Age Restriction`, oldValue: oldAge, newValue: newAge });
        }

        // Daily Offer
        const originalOffer = originalDay.daily_offer;
        const localOffer = localDay.daily_offer;
        if (originalOffer && !localOffer) {
            changes.push({ field: `${day.charAt(0).toUpperCase() + day.slice(1)} Offer`, change: "Deleted" });
        } else if (!originalOffer && localOffer) {
            changes.push({ field: `${day.charAt(0).toUpperCase() + day.slice(1)} Offer`, change: "Added" });
        } else if (originalOffer && localOffer && originalOffer !== localOffer) {
            changes.push({ field: `${day.charAt(0).toUpperCase() + day.slice(1)} Offer`, change: "Updated" });
        }
    });

    return changes;
}

// Main function to handle the save button click
function showChangesPopup() {

    if (getClubSession() === "add-new") {
        // Save club
    }
    // else show actual changes for the club you own

    const changes = getChanges();
    if (changes.length === 0) {
        alert("No changes to save.");
        return;
    }

    const popup = document.createElement("div");
    popup.className = "offer-popup"; // Reuse consistent popup styling

    const header = document.createElement("h3");
    header.className = "popup-header";
    header.textContent = "Confirm Changes";
    popup.appendChild(header);

    const content = document.createElement("div");
    content.className = "popup-content";

    const list = document.createElement("ul");
    list.style.paddingLeft = "20px";
    changes.forEach(change => {
        const li = document.createElement("li");
        li.textContent = change.change
            ? `${change.field}: ${change.change}`
            : `${change.field}: ${change.oldValue} → ${change.newValue}`;
        list.appendChild(li);
    });
    content.appendChild(list);
    popup.appendChild(content);

    const footer = document.createElement("div");
    footer.className = "popup-footer";

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => popup.remove());
    footer.appendChild(cancelButton);

    const confirmButton = document.createElement("button");
    confirmButton.textContent = "Yes, Save Changes";
    confirmButton.style.backgroundColor = "var(--night-view-green)";
    confirmButton.addEventListener("click", () => {
        saveChanges();
        popup.remove();
    });
    footer.appendChild(confirmButton);

    popup.appendChild(footer);

    // Apply consistent popup position styling
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.color = "#000"; // Ensures visible text
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    popup.style.zIndex = "1000";


    document.body.appendChild(popup);

    const closePopup = (e) => {
        if (!popup.contains(e.target)) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}


// Placeholder for saving logic
async function saveChanges() {

    // const errors = validateClubData();
    // if (errors.length > 0) {
    //     alert("Please fix the following issues:\n\n" + errors.join("\n"));
    //     return;


//   localClubData = prepareDataForUpload(...localClubData); //TODO one

// Clean up: Set any useless day object to `null`


    console.log("Saving changes...", localClubData);
    const selectedClubId = getClubSession(); // Get the currently selected club ID
    if (!selectedClubId) {
        alert("No club selected to save.");
        return;
    }

    // Format logo
    localClubData.logo = await getAvailableLogoName(localClubData.name);

    collectAllDaysData();
    calculateEntryPriceAndAgeAndResetDaily();
    const changes = getChanges(); // Get list of detected changes

    Object.keys(localClubData.opening_hours).forEach((day) => {
        const hoursField = document.getElementById(`${day}-hours`);
        const isClosed = hoursField?.value?.trim().toLowerCase() === "closed";
        if (isClosed) {
            localClubData.opening_hours[day] = null;
        }
    });

    try {
        const clubIdName = localClubData.logo
            .replace(".webp", "")
            .replace("_logo", "") // 🔥 This removes "_logo.webp"
            .replace(/\s+/g, "_");

        let clubIdForUpload = selectedClubId === "add-new" ? clubIdName : selectedClubId;

        if (selectedClubId === "add-new") {
            // 🆕 NEW CLUB: Save all localClubData into club_data_new
            const customDocRef = doc(db, databaseCollections.newClubs, clubIdName);

            localClubData.created_by = getSession().uid;
            localClubData.created_at = serverTimestamp();
            localClubData.processed = false;

            await setDoc(customDocRef, localClubData);
            console.log("New club added with custom ID:", clubIdName);
        } else {
            // 🛠️ EXISTING CLUB: Save only the changes into club_data_changes
            const changePayload = {
                clubId: selectedClubId,    // Keep track which club is changed
                changes: changes,          // All the fields that changed
                timestamp: new Date(),     // Optional: track when change was made
                madeBy: getSession().uid,  // Optional: track who made the change
            };
            // console.log("Changes saved to club_data_changes with ID:", changeRef.id);
        }

// Upload deferred logo if needed
        if (pendingLogoBlob && pendingLogoFilename) {
            pendingLogoFilename = localClubData.logo;

            const path = `${databaseStorage.clubLogos}/${pendingLogoFilename}`;
            await uploadImageToFirestore(pendingLogoBlob, path);
            pendingLogoBlob = null;
            pendingLogoFilename = null;
        }

        for (const day of Object.keys(localClubData.opening_hours)) {
            const dayData = localClubData.opening_hours[day];
            const offerName = dayData?.daily_offer;
            const offerImageData = localOfferImages[day];

            if (offerName && offerImageData?.blob) {
                console.log(`Uploading offer for ${day}:`, offerName, offerImageData.blob);
                const path = `${databaseStorage.clubImages}/${clubIdForUpload}/${databaseStorage.clubOffers}/${offerName}`;
                await uploadImageToFirestore(offerImageData.blob, path);
                console.log(`✅ Uploaded daily offer for ${day}: ${offerName}`);
            }
        }

        if (window.menuImages?.length) {
            for (const img of window.menuImages) {
                const path = `${databaseStorage.clubImages}/${clubIdForUpload}/${img.name}`;
                await uploadImageToFirestore(img.file, path);
                console.log(`✅ Uploaded menu image: ${img.name}`);
            }
        }

        alert("New club submitted for approval!");
    } catch (error) {
        console.error("Error saving changes:", error);
        alert("Failed to save changes. Please try again.");
    }
}

function collectAllDaysData() {
    days.forEach(day => {
        const hoursValue = document.getElementById(`${day}-hours`).value;
        let dayData = localClubData.opening_hours[day] || {};

        if (hoursValue === "Closed") {
            localClubData.opening_hours[day] = null;
        } else {
            const [open, close] = hoursValue.split(" - ");
            dayData = {...dayData, open, close};
        }

        const ageValue = document.getElementById(`${day}-age`).value.replace("+", "");
        const ageRestriction = ageValue ? parseInt(ageValue) : localClubData.age_restriction;
        dayData.ageRestriction = ageRestriction >= 16 ? ageRestriction : localClubData.age_restriction;

        localClubData.opening_hours[day] = dayData;
    });
}

function prepareNewClubForm() {
    openLocationSection();
    console.log("Preparing new club form...");

    originalDbData = createEmptyClubData();
    localClubData = createEmptyClubData();

    mainOfferImgUrl = null;
    localOfferImages = {};

    document.querySelector(".header-title").textContent = "";
    document.getElementById("clubNameInput").value = "";
    document.getElementById("clubDisplayName").value = "";

    const typeOfClubSelect = document.getElementById("typeOfClubSelect");
    if (typeOfClubSelect) {
        typeOfClubSelect.innerHTML = "";
        Object.entries(CLUB_TYPES_ENGLISH).forEach(([dbValue, displayLabel]) => {
            const option = document.createElement("option");
            option.value = dbValue;
            option.textContent = displayLabel;
            typeOfClubSelect.appendChild(option);
        });
        typeOfClubSelect.value = "";
    }

    document.getElementById("lat").value = "";
    document.getElementById("lon").value = "";

    for (let i = 1; i <= 4; i++) {
        document.getElementById(`corner${i}-lat`).value = "";
        document.getElementById(`corner${i}-lon`).value = "";
    }

    document.getElementById("maxVisitors").value = "";
    document.getElementById("entryPrice").value = "0";
    document.getElementById("primaryColor").value = "NightView Green";
    document.getElementById("secondaryColor").value = "NightView Black";

    const fontSelect = document.getElementById("font");
    if (fontSelect) {
        fontSelect.value = "NightView Font";
        new FontSelector("fontFieldItem", (selectedFont) => {
            localClubData.font = selectedFont;
            syncAndUpdatePreview();
        });
    }

    const clubLogoImg = document.getElementById("clubLogoImg");
    if (clubLogoImg) {
        clubLogoImg.src = "";
        clubLogoImg.addEventListener("click", () => showLogoPopup("add-new", clubLogoImg));
    }

    const clubTypeImg = document.getElementById("clubTypeImg");
    if (clubTypeImg) {
        clubTypeImg.src = "../images/default_type.png";
    }

    days.forEach(day => {
        document.getElementById(`${day}-hours`).value = "Closed";
        document.getElementById(`${day}-age`).value = "Not set";
        const offerButton = document.getElementById(`${day}-offer`);
        if (offerButton) {
            offerButton.textContent = "Add Offer";
            offerButton.classList.remove("has-offer");
            // Remove existing listener to prevent duplicates
            offerButton.removeEventListener("click", offerButton._clickHandler);
            offerButton._clickHandler = () => handleOfferAction(day, "add-new", offerButton);
            offerButton.addEventListener("click", offerButton._clickHandler);
        } else {
            console.warn(`No offer button found for ${day}`);
        }
    });


    const addImageBtn = document.getElementById("addImageBtn");
    if (addImageBtn) {
        addImageBtn.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.click();

            input.onchange = async () => {
                const file = input.files[0];
                if (!file) return;

                const imageName = prompt("Write the name of the beverage", file.name.replace(/\.[^/.]+$/, ""));
                if (!imageName) return;

                const tempUrl = URL.createObjectURL(file);

                const menuImage = {
                    file: file,
                    previewUrl: tempUrl,
                    name: imageName // ✅ store name
                };

                if (!window.menuImages) window.menuImages = [];
                window.menuImages.push(menuImage);
                updateImagesSection(getClubSession());
            };

        });
    }

    updateImagesSection("add-new");
    setupLivePreviewBindings();
    bindLeftInputs();
    syncAndUpdatePreview();
}


function openLocationSection() {
    const locationDetails = document.querySelector('details summary');
    if (!locationDetails) return;

    const allDetails = document.querySelectorAll('details');
    // // allDetails.forEach(d => d.open = false); // Optional: collapse others if you want
    //
    // // Find the Location section specifically
    const summaries = Array.from(document.querySelectorAll('details > summary'));
    const locationSummary = summaries.find(summary => summary.textContent.trim().toLowerCase() === 'location');
    if (allDetails) {
        locationSummary.parentElement.open = true; // Open the details section
        locationSummary.scrollIntoView({behavior: 'smooth', block: 'start'}); // Scroll nicely
    }
}

async function getAvailableLogoName(clubName) {
    const sanitizedClubName = clubName.trim().replace(/\s+/g, "_");
    let index = 0;
    let newFileName;

    // Fetch existing IDs from both collections
    const [dataSnap, newDataSnap] = await Promise.all([
        getDocs(collection(db, databaseCollections.clubData)),
        getDocs(collection(db, databaseCollections.newClubs))
    ]);
    const existingDocIds = [
        ...dataSnap.docs.map(doc => doc.id),
        ...newDataSnap.docs.map(doc => doc.id)
    ];

    // Loop until we find a free ID
    do {
        newFileName = `${sanitizedClubName}_${index}_logo.webp`;
        index++;
    } while (existingDocIds.includes(newFileName.replace(".webp", "")));

    return newFileName;
}

async function getAvailableId(clubName) {
    const sanitizedClubName = clubName.trim().replace(/\s+/g, "_");
    let index = 0;
    let newId;

    const [dataSnap, newDataSnap] = await Promise.all([
        getDocs(collection(db, databaseCollections.clubData)),
        getDocs(collection(db, databaseCollections.newClubs))
    ]);

    const existingDocIds = [
        ...dataSnap.docs.map(doc => doc.id),
        ...newDataSnap.docs.map(doc => doc.id)
    ];

    do {
        newId = `${sanitizedClubName}_${index}`;
        index++;
    } while (existingDocIds.includes(newId));

    return newId;
}

function calculateEntryPriceAndAgeAndResetDaily() {
    const ageCounts = {};
    // const priceCounts = {};
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

    // Step 1: Count existing age and price values
    days.forEach(day => {
        const dayData = localClubData.opening_hours?.[day];
        if (!dayData) return;

        if (dayData.ageRestriction != null) {
            ageCounts[dayData.ageRestriction] = (ageCounts[dayData.ageRestriction] || 0) + 1;
        }

        // if (dayData.entry_price != null) {
        //     priceCounts[dayData.entry_price] = (priceCounts[dayData.entry_price] || 0) + 1;
        // }
    });

    // Step 2: Determine most common values
    const mostCommonAgeEntry = Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0];
    // const mostCommonPriceEntry = Object.entries(priceCounts).sort((a, b) => b[1] - a[1])[0];

    const mostCommonAge = mostCommonAgeEntry ? parseInt(mostCommonAgeEntry[0]) : 10;
    // const mostCommonPrice = mostCommonPriceEntry ? parseFloat(mostCommonPriceEntry[0]) : 0;

    localClubData.age_restriction = mostCommonAge;
    // localClubData.entry_price = mostCommonPrice;

    // Step 3: Nullify matching age/price per day (to reduce redundancy)
    days.forEach(day => {
        const dayData = localClubData.opening_hours?.[day];
        if (!dayData) return;

        if (dayData.ageRestriction === mostCommonAge) {
            dayData.ageRestriction = null;
        }

        // if (dayData.entry_price === mostCommonPrice) {
        dayData.entry_price = null; // TODO. Null for now!
        // }
    });
}


function createEmptyClubData() {
    return {
        name: "",
        displayName: null,
        type_of_club: "",
        lat: null,
        lon: null,
        corners: [],
        total_possible_amount_of_visitors: 0,
        entry_price: 0,
        primary_color: "NightView Green",
        secondary_color: "NightView Black",
        font: "NightView Font",
        opening_hours: {
            monday: null,
            tuesday: null,
            wednesday: null,
            thursday: null,
            friday: null,
            saturday: null,
            sunday: null
        },
        logo: ""
    };
}

function validateClubData() {
    const errors = [];

    // ✅ Required & type-validated fields
    if (!localClubData.name?.trim()) errors.push("Name is required.");
    if (!localClubData.type_of_club?.trim()) errors.push("Club type is required.");
    // if (!localClubData.logo?.trim()) errors.push("Logo is required.");
    // if (!localClubData.primary_color?.trim()) errors.push("Primary color is required.");
    // if (!localClubData.secondary_color?.trim()) errors.push("Secondary color is required.");
    // if (!localClubData.font?.trim()) errors.push("Font must be selected.");

    // ✅ Numbers with range checks
    if (!(localClubData.total_possible_amount_of_visitors > 0)) errors.push("Capacity must be a number greater than 0.");
    if (isNaN(localClubData.entry_price) || localClubData.entry_price < 0) errors.push("Entry price must be a non-negative number.");
    if (isNaN(localClubData.lat) || localClubData.lat < -90 || localClubData.lat > 90) errors.push("Latitude must be between -90 and 90.");
    if (isNaN(localClubData.lon) || localClubData.lon < -180 || localClubData.lon > 180) errors.push("Longitude must be between -180 and 180.");

    // ✅ Opening hours validation (at least 1 valid day)
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const hasValidDay = days.some(day => {
        const hours = localClubData.opening_hours?.[day];
        return hours && hours.open && hours.close && hours.open !== "00:00" && hours.close !== "00:00";
    });
    if (!hasValidDay) errors.push("At least one day must have valid opening hours.");

    return errors;
}

function updateImagesSection(clubId) {
    const imageManager = document.getElementById("imageManager");
    if (!imageManager) return;

    let wrapper = imageManager.querySelector(".image-button-wrapper");
    if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "image-button-wrapper";
        imageManager.appendChild(wrapper);
    }

    // Clear existing buttons except the "Add Image" button
    wrapper.querySelectorAll("button:not(#addImageBtn)").forEach(btn => btn.remove());

    let addImageBtn = wrapper.querySelector("#addImageBtn");
    if (!addImageBtn) {
        addImageBtn = document.createElement("button");
        addImageBtn.id = "addImageBtn";
        addImageBtn.className = "button button-add-image";
        addImageBtn.textContent = "➕ Add Image";

        // ✅ Attach the click event handler here
        addImageBtn.addEventListener("click", () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.click();

            input.onchange = async () => {
                const file = input.files[0];
                if (!file) return;

                const imageName = prompt("Write the name of the beverage.", file.name.replace(/\.[^/.]+$/, ""));
                if (!imageName) return;

                const tempUrl = URL.createObjectURL(file);

                const menuImage = {
                    file: file,
                    previewUrl: tempUrl,
                    name: imageName
                };

                if (!window.menuImages) window.menuImages = [];
                window.menuImages.push(menuImage);
                updateImagesSection(clubId); // ✅ Trigger re-render
            };
        });

        wrapper.appendChild(addImageBtn);
    }


    // Add Logo button
    if (localClubData.logo) {
        const logoButton = document.createElement("button");
        logoButton.textContent = "Logo";
        logoButton.className = "button button-image";
        logoButton.addEventListener("click", () => showLogoPopup(clubId, document.getElementById("clubLogoImg")));
        wrapper.insertBefore(logoButton, document.getElementById("addImageBtn"));
    }

    // Add Daily Offer buttons
    days.forEach(day => {
        const hasSpecificOffer = !!localClubData?.opening_hours?.[day]?.daily_offer;
        if (hasSpecificOffer) {
            const offerButton = document.createElement("button");
            offerButton.textContent = `${toTitleCase(day)} Offer`;
            offerButton.className = "button button-image";
            offerButton.addEventListener("click", () => {
                getOfferImageUrl(clubId, day).then(url =>
                    showImagePopup(clubId, day, url || "../images/default_offer.png", offerButton)
                );
            });
            wrapper.insertBefore(offerButton, document.getElementById("addImageBtn"));
        }
    });

    // Add Menu Images (Drinks / Menu Photos)
    if (window.menuImages?.length) {
        // TODO need to be able to rename these pictures
        window.menuImages.forEach((imgData, index) => {
            const menuButton = document.createElement("button");
            menuButton.className = "button button-image";

            const img = document.createElement("img");
            img.src = imgData.previewUrl;
            img.alt = imgData.name;
            menuButton.appendChild(img);

            const label = document.createElement("span");
            label.textContent = imgData.name || `Menu Image ${index + 1}`;
            menuButton.appendChild(label);

            menuButton.addEventListener("click", () => showMenuImagePopup(imgData, index));
            wrapper.insertBefore(menuButton, addImageBtn);
        });
    }

}

function showMenuImagePopup(imgData, index) {
    const popup = document.createElement("div");
    popup.className = "offer-popup";

    const header = document.createElement("h3");
    header.textContent = imgData.name || `Menu Image ${index + 1}`;
    popup.appendChild(header);

    const img = document.createElement("img");
    img.src = imgData.previewUrl;
    img.style.maxWidth = "100%";
    img.style.maxHeight = "80vh";
    popup.appendChild(img);

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete Image";
    deleteButton.addEventListener("click", () => {
        window.menuImages.splice(index, 1); // Remove the image
        updateImagesSection(getClubSession()); // Redraw section
        popup.remove();
    });
    popup.appendChild(deleteButton);

    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    popup.style.zIndex = "1000";

    document.body.appendChild(popup);

    const renameButton = document.createElement("button");
    renameButton.textContent = "Rename Image";
    renameButton.style.backgroundColor = "var(--night-view-green)";
    renameButton.addEventListener("click", () => {
        const newName = prompt("Enter new name:", imgData.name || `Menu Image ${index + 1}`);
        if (newName) {
            imgData.name = newName;
            updateImagesSection(getClubSession());
            popup.remove();
        }
    });
    popup.appendChild(renameButton);


    const closePopup = (e) => {
        if (!popup.contains(e.target)) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}


function showImagePopup(clubId, imageType, imageUrl, buttonElement) {
    const isLogo = imageType === "logo";
    const day = isLogo ? null : imageType;
    const popup = document.createElement("div");
    popup.className = "offer-popup";

    const header = document.createElement("h3");
    header.className = "popup-header";
    header.textContent = isLogo ? "Club Logo" : `Offer for ${toTitleCase(day)}`;
    popup.appendChild(header);

    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = isLogo ? "Club Logo" : `Offer for ${day}`;
    img.style.maxWidth = "100%";
    img.style.maxHeight = "80vh";
    popup.appendChild(img);

    const uploadButton = document.createElement("button");
    uploadButton.textContent = isLogo ? "Change Logo" : "Change Offer";
    uploadButton.style.backgroundColor = "var(--night-view-green)";
    uploadButton.addEventListener("click", () => {
        if (isLogo) {
            uploadNewLogo(clubId, document.getElementById("clubLogoImg"), popup);
        } else {
            uploadSpecificOffer(day, clubId, document.getElementById(`${day}-offer`), popup);
        }
    });
    popup.appendChild(uploadButton);

    if (!isLogo && localClubData?.opening_hours?.[day]?.daily_offer) {
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete Offer";
        deleteButton.addEventListener("click", () => {
            if (confirm(`Are you sure you want to delete the offer for ${day}?`)) {
                delete localClubData.opening_hours[day].daily_offer;
                delete localOfferImages[day];
                syncClubDataCache(clubId);
                const offerButton = document.getElementById(`${day}-offer`);
                offerButton.textContent = mainOfferImgUrl ? "Main Offer" : "Add Offer";
                offerButton.classList.toggle("has-offer", !!mainOfferImgUrl);
                updateImagesSection(clubId);
                if (day === getTodayKey()) syncAndUpdatePreview();
                popup.remove();
            }
        });
        popup.appendChild(deleteButton);
    }

    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    popup.style.zIndex = "1000";
    document.body.appendChild(popup);

    const closePopup = (e) => {
        if (!popup.contains(e.target)) {
            popup.remove();
            document.removeEventListener("click", closePopup);
        }
    };
    setTimeout(() => document.addEventListener("click", closePopup), 0);
}





// Event listeners
document.getElementById("saveButton").addEventListener("click", showChangesPopup);

document.addEventListener("change", handleGenericInput);
document.addEventListener("input", handleGenericInput);

function handleGenericInput(e) {
    // const isRelevantField = e.target.matches("input, select, textarea");
    // if (isRelevantField) {
    syncAndUpdatePreview();
    // }
}

window.addEventListener("clubChanged", () => {
    const selectedClubId = getClubSession();
    const uid = getSession().uid;
    const role = getSession().role;
    if (selectedClubId && window.currentUser) {
        loadData({uid, role}, selectedClubId);
    } else {
        console.log("No selected club or user context available.");
    }
});

document.getElementById("resetButton").addEventListener("click", () => {
    const clubId = getClubSession();
    if (clubId) {
        resetData(clubId);
    } else {
        alert("Cannot reset — missing club info.");
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        const popups = document.querySelectorAll(
            ".color-picker-popup, .font-picker-popup, .time-picker-popup, .age-picker-popup, .offer-popup"
        );
        popups.forEach(popup => popup.remove());
    }
});


