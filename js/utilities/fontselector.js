// fontselector.js

export class FontSelector {
    constructor(containerId, onFontChange) {
        this.fonts = [
            // Custom Font
            "NightView Font",

            // Web-Safe Fonts
            "Arial",
            "Arial Black",
            "Verdana",
            "Tahoma",
            "Trebuchet MS",
            "Times New Roman",
            "Georgia",
            "Garamond",
            "Courier New",
            "Brush Script MT",
            "Impact",
            "Comic Sans MS",
            "Lucida Console",
            "Century Gothic",
            "Palatino Linotype",
            "Book Antiqua",
            "Candara",
            "Calibri",
            "Cambria",
            "Consolas",
            "Franklin Gothic Medium",
            "Gill Sans",
            "Geneva",
            "Optima",
            "Segoe UI",
            "Symbol",
            "Lucida Sans Unicode",
            "MS Serif",
            "MS Sans Serif",

            // Popular Google Fonts
            "Roboto",
            "Open Sans",
            "Lato",
            "Oswald",
            "Montserrat",
            "Source Sans Pro",
            "Raleway",
            "PT Sans",
            "Merriweather",
            "Noto Sans",
            "Ubuntu",
            "Playfair Display",
            "Poppins",
            "Nunito",
            "Quicksand",
            "Fira Sans",
            "Inconsolata",
            "Droid Sans",
            "Titillium Web",
            "Exo",
            "Josefin Sans",
            "Cabin",
            "Bitter",
            "Arvo",
            "Varela Round",
            "Muli",
            "Work Sans",
            "Zilla Slab",
            "Karla",
            "Heebo",
            "Barlow",
            "IBM Plex Sans",
            "Assistant",
            "Catamaran",
            "Cairo",
            "Hind",
            "Kanit",
            "Maven Pro",
            "Mukta",
            "Nanum Gothic",
            "Pathway Gothic One",
            "Ropa Sans",
            "Saira",
            "Sarabun",
            "Tajawal",
            "Yanone Kaffeesatz",
            "Ysabeau",

            // Additional Popular Fonts
            "Helvetica",
            "Futura",
            "Baskerville",
            "Bodoni",
            "Didot",
            "Rockwell",
            "Avenir",
            "Univers",
            "Frutiger",
            "Myriad Pro",
            "DIN",
            "Eurostile",
            "Avant Garde",
            "Bookman Old Style",
            "Perpetua",
            "Gotham",
            "Neutraface",
            "Proxima Nova",
            "Brandon Grotesque",
            "Circular",
            "GT Walsheim",
            "Apercu",
            "Maison Neue",
            "Graphik",
            "Canela",
            "Druk",
            "Founders Grotesk",
            "Mabry",
            "Neue Haas Grotesk",
            "Ogg",
            "GT America",
            "Brown",
            "Caslon",
            "GT Sectra",
            "Akkurat",
            "Untitled Sans",
            "Lexend",
            "Space Grotesk",
            "Suisse Int'l",
            "Noe Display",
            "Recoleta",
            "Sohne",
            "PP Neue Montreal",
            "Clash Display",
            "Suisse Works",
            "Editorial New",
            "General Sans",
            "Migra",
            "Canela Text",
            "PP Neue World",
            "PP Neue World Engrave Bold Italic"
        ];
        this.container = document.getElementById(containerId);
        this.onFontChange = onFontChange;
        // this.loadGoogleFonts(this.fonts); TODO

        if (this.container) this.render();
    }

    loadGoogleFonts(fonts) { // TODO
        const existing = document.getElementById("google-fonts-link");
        if (existing) return;

        const fontFamilies = fonts
            .filter(f => !["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia", "Trebuchet MS", "Lucida Console", "Comic Sans MS", "NightView Font"].includes(f))
            .map(f => f.replace(/ /g, "+"))
            .join("&family=");

        const link = document.createElement("link");
        link.id = "google-fonts-link";
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`;

        document.head.appendChild(link);
    }


    render() {
        let select = this.container.querySelector("#font");
        if (!select) {
            select = document.createElement("select");
            select.id = "font";
            select.style.cursor = "pointer";
            this.container.appendChild(select);
        }

        select.innerHTML = "";
        this.fonts.forEach(font => {
            const option = document.createElement("option");
            option.value = font;
            option.textContent = font;
            option.style.fontFamily = font;
            select.appendChild(option);
        });

        select.addEventListener("change", (e) => {
            if (this.onFontChange) this.onFontChange(e.target.value);
        });
    }
}
