// utiliy.js

export function toTitleCase(str) {
    return str
        .toLowerCase()
        .split(" ")
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



