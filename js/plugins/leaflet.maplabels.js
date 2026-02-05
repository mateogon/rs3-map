import "../leaflet.js";

export default void (function (factory) {
    var L;
    if (typeof define === "function" && define.amd) {
        define(["leaflet"], factory);
    } else if (typeof module !== "undefined") {
        L = require("leaflet");
        module.exports = factory(L);
    } else {
        if (typeof window.L === "undefined") {
            throw new Error("Leaflet must be loaded first");
        }
        factory(window.L);
    }
})(function (L) {
    let MaplabelGroup = L.LayerGroup.extend({
        initialize: function (options) {
            L.LayerGroup.prototype.initialize.call(this, {}, options);
        },

        onAdd: function (map) {
            let url = `https://sheets.googleapis.com/v4/spreadsheets/${this.options.SHEET_ID}/values/A:Z?key=${this.options.API_KEY}`;
            fetch(url)
                .then((res) => res.json())
                .then((sheet) => {
                    let markers = this.parse_sheet(sheet);
                    let marker_iter = markers[Symbol.iterator]();
                    for (const marker of marker_iter) {
                        this.addLayer(marker);
                    }
                });
            L.LayerGroup.prototype.eachLayer.call(this, map.addLayer, map);

            const updateScale = (zoom) => {
                // Clamp scale to prevent labels from becoming illegibly small or absurdly large?
                // User said "too large... clamp it".
                // Let's just set the logical scale for now. 
                // If they want it restricted, maybe min/max?
                // But preventing "Too Large" means ensuring it SCALES DOWN.
                 let scale = map.getZoomScale(zoom, 2);
                // Clamp scale to max 1 (100% size) to prevent oversized labels when zooming in
                if (scale > 1) scale = 1;
                
                map.getContainer().style.setProperty('--label-scale', scale);
            };

            updateScale(map.getZoom());

            map.on("zoomanim", (e) => {
                updateScale(e.zoom);
            });
            
            map.on("zoomend", () => {
                 updateScale(map.getZoom());
            });
        },

        onRemove: function (map) {
            L.LayerGroup.prototype.eachLayer.call(this, map.removeLayer, map);
        },

        parse_sheet: function (sheet) {
            return sheet.values.map((row) => this.create_textlabel(...row));
        },

        create_textlabel: function (x, y, plane, description) {
            let text = document.createTextNode(description);
            let sub = document.createElement("div");
            sub.appendChild(text);
            sub.setAttribute("class", "map-label-sub-container");

            let html = document.createElement("div");
            html.setAttribute("class", "map-label-container");
            html.setAttribute("style", "transform: translate(-50%, -50%)");
            html.appendChild(sub);

            let divicon = L.divIcon({
                html: html,
                iconSize: null, // I love gross hacks! necessary to not make the text 12x12px
                className: "map-label",
            });

            let marker = L.marker([Number(y), Number(x)], {
                icon: divicon,
            });

            return marker;
        },
    });

    L.maplabelGroup = function (options) {
        return new MaplabelGroup(options);
    };
});
