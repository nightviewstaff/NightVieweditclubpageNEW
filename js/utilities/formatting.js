import {MESSAGES} from "./constants.js";

export class DateConvert {
    static formatDateTime(dateTime) {
        return dateTime
            ? new Intl.DateTimeFormat("da-DK", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
            }).format(new Date(dateTime))
            : MESSAGES.NOT_DELIVERED;
    }
}

export const clubTypeImages = {
    "bar_club": "bar_club_icon.png",
    "bar": "bar_icon.png",
    "beer_bar": "beer_bar_icon.png",
    "bodega": "bodega_icon.png",
    "club": "club_icon.png",
    "cocktail_bar": "cocktail_bar_icon.png",
    "gay_bar": "gay_bar_icon.png",
    "jazz_bar": "jazz_bar_icon.png",
    "karaoke_bar": "karaoke_bar_icon.png",
    "live_music_bar": "live_music_bar_icon.png",
    "pub": "pub_icon.png",
    "sports_bar": "sports_bar_icon.png",
    "wine_bar": "wine_bar_icon.png"
};






