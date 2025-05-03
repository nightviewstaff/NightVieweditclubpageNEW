// constants.js

const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const databaseCollections = {
    notifications: "notifications",
    newClubs: "club_data_new",
    clubChanges: "club_data_changes",
    clubData: "club_data",
    users: "user_data",
};

const databaseStorage ={
    clubLogos: "club_logos",
    clubImages: "club_images",
    clubOffers: "offers",
}

const MESSAGES_DANISH = {
    LOADING: "Henter...",


};

const MESSAGES_ENGLISH = {
    LOADING: "Loading...",
    DISPLAY_NAME: "Display Name",

};

const CLUB_TYPES_DANISH = {
    bar: "Bar",
    bar_club: "Bar/Klub",
    beer_bar: "Ølbar",
    bodega: "Bodega",
    club: "Klub",
    cocktail_bar: "Cocktailbar",
    gay_bar: "Gaybar",
    jazz_bar: "Jazzbar",
    karaoke_bar: "Karaokebar",
    live_music_bar: "Livemusikbar",
    pub: "Pub",
    sports_bar: "Sportsbar",
    wine_bar: "Vinbar"
};

const CLUB_TYPES_ENGLISH = {
    bar: "Bar",
    bar_club: "Bar/Club",
    beer_bar: "Beer Bar",
    bodega: "Bodega",
    club: "Club",
    cocktail_bar: "Cocktail Bar",
    gay_bar: "Gay Bar",
    jazz_bar: "Jazz Bar",
    karaoke_bar: "Karaoke Bar",
    live_music_bar: "Live Music Bar",
    pub: "Pub",
    sports_bar: "Sports Bar",
    wine_bar: "Wine Bar"
};

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


//TODO TYPE OF CLUBS SMARTER

export {
    MESSAGES_DANISH,
    MESSAGES_ENGLISH,
    CLUB_TYPES_ENGLISH,
    CLUB_TYPES_DANISH,
    databaseCollections,databaseStorage, days
};