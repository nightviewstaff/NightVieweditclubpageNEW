// utiliy.js

export function getTodayKey() {
    return new Date().toLocaleDateString("en-US", {weekday: "long"}).toLowerCase();
}

export function toTitleCase(str) {
    if (typeof str !== "string" || !str.trim()) return "";

    return str
        .toLowerCase()
        .split(/\s+/) // handles multiple spaces, tabs, newlines
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}


export function calculateUserAge(user) {
    const birthDate = new Date(user.birthdate_year, user.birthdate_month - 1, user.birthdate_day); // JS months are 0-based
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const hasHadBirthdayThisYear =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

    if (!hasHadBirthdayThisYear) {
        age--;
    }

    return age;
}

export function getUserNationality(user) {
    if (user.phone.startsWith('+45')) {
        return "Danish";
    } else {
        return "International";
    }
}

export function getUserGender(user) {
    // if (user.gender.toLowerCase() === "f") {
    //     return "F";
    // } else {
        return "M";
    // }
}

export function generateCorrectID(name) {

    return;
}

/**
 * Converts any image File to a WebP Blob using canvas.
 * @param {File} file - The original image file.
 * @returns {Promise<Blob>} - The converted WebP blob.
 */
export async function convertToWebP(file) {

    //TODO Check if already Webp and return if.
    if (file.type === "image/webp") {
        return;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target.result;
        };

        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("WebP conversion failed"));
            }, "image/webp", 0.8); // You can adjust quality if needed
        };

        reader.onerror = reject;
        img.onerror = reject;

        reader.readAsDataURL(file);
    });
}

export function genericPopup() {

}




