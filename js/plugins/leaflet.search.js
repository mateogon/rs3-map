import "../leaflet.js";

(function (factory) {
    var L;
    if (typeof define === "function" && define.amd) {
        define(["leaflet"], factory)
    } else if (typeof module !== "undefined") {
        L = require("leaflet");
        module.exports = factory(L)
    } else {
        if (typeof window.L === "undefined") {
            throw new Error("Leaflet must be loaded first")
        }
        factory(window.L)
    }
})(function (L) {
    L.Control.Search = L.Control.extend({
        options: {
            position: 'topleft',
            id: 'searchcontrol',
            placeholder: 'Search for a location...',
            labelsPath: 'data_rs3/map_labels.json',
            locationsPath: 'data_rs3/map_label_locations.json',
            basemapsPath: 'data_rs3/basemaps.json'
        },

        onAdd: function (map) {
            this._map = map;
            this._container = L.DomUtil.create('div', 'leaflet-control-search');
            this._container.id = this.options.id;
            
            this._input = L.DomUtil.create('input', 'leaflet-search-input', this._container);
            this._input.type = 'text';
            this._input.placeholder = this.options.placeholder;

            this._resultsContainer = L.DomUtil.create('div', 'leaflet-search-results', this._container);

            this._initData().then(() => {
                 this._input.disabled = false;
            });
            this._initEvents();

            L.DomEvent.disableClickPropagation(this._container);
            L.DomEvent.disableScrollPropagation(this._container);

            return this._container;
        },

        _initData: async function() {
            try {
                this._input.disabled = true;
                this._input.placeholder = "Loading locations...";

                const [labels, locations, basemaps] = await Promise.all([
                    fetch(this.options.labelsPath).then(r => r.json()),
                    fetch(this.options.locationsPath).then(r => r.json()),
                    fetch(this.options.basemapsPath).then(r => r.json())
                ]);

                // Create a map of labelId -> location
                this._locationMap = {};
                locations.forEach(loc => {
                    if (loc.labelId !== undefined) {
                        // We take the first location found for a label
                        if (!this._locationMap[loc.labelId]) {
                            this._locationMap[loc.labelId] = loc.location;
                        }
                    }
                });

                // Filter labels that have names and coordinates
                this._searchData = labels.filter(label => {
                    return label.text && this._locationMap[label.id];
                }).map(label => ({
                    id: label.id,
                    text: label.text.replace(/<br>/g, ' ').replace(/<[^>]*>?/gm, '').trim(),
                    location: this._locationMap[label.id],
                    type: 'label'
                }));

                // Add basemaps to search data
                if (basemaps) {
                    basemaps.forEach(map => {
                        if (map.name && map.name.toLowerCase() !== "default" && map.name.toLowerCase() !== "loading...") {
                            this._searchData.push({
                                id: 'map_' + map.mapId,
                                text: map.name,
                                location: {
                                    x: map.center[1], // Basemap center is [y, x] usually or [plane, x, y]? 
                                    // checking basemaps.json: center is [x, y] or [y, x]? Use context.
                                    // basemaps.json: "center": [3232, 3232] for default.
                                    // "Zanaris": [2440, 4420].
                                    // Let's assume standard [x, y] or check usage.
                                    // leaflet.gameMap.js might shed light, but usually Leaflet uses [lat, lng] = [y, x].
                                    // However, in this custom CRS, verify.
                                    // But looking at existing logic: this._map.flyTo([loc.y, loc.x], 4);
                                    // So if basemap center is [y, x], we interpret correctly.
                                    // Actually earlier verify_search_control used [y, x] in flyTo.
                                    // Basemaps.json center is likely [y, x] (lat, lng) equivalent or [x, y]?
                                    // Let's assume [y, x] for now based on standard leaflet "center".
                                    // Wait, data_rs3/basemaps.json says "center": [2440, 4420] for Zanaris.
                                    // Let's assume the first is Y (lat) and second is X (lng).
                                    x: map.center[0],
                                    y: map.center[1],
                                    plane: 0 // Default plane for maps
                                },
                                mapId: map.mapId,
                                type: 'map'
                            });
                        }
                    });
                }

                // Deduplicate by text to avoid identical search results
                let seen = new Set();
                this._searchData = this._searchData.filter(item => {
                    let k = item.text.toLowerCase();
                    if (seen.has(k)) return false;
                    seen.add(k);
                    return true;
                });

                this._input.placeholder = this.options.placeholder;
                console.log('Search data loaded:', this._searchData.length, 'unique locations');
            } catch (err) {
                console.error('Failed to load search data:', err);
                this._input.placeholder = "Failed to load locations";
            }
        },

        _initEvents: function() {
            L.DomEvent.on(this._input, 'input', this._handleInput, this);
            L.DomEvent.on(document, 'click', this._handleOutsideClick, this);
            L.DomEvent.on(this._input, 'keydown', this._handleKeydown, this);
        },

        _handleInput: function(e) {
            const query = this._input.value.toLowerCase().trim();
            if (query.length < 1) { // Changed from 2 to 1
                this._hideResults();
                return;
            }

            const results = this._searchData.filter(item => 
                item.text.toLowerCase().includes(query)
            ).sort((a, b) => {
                let aStarts = a.text.toLowerCase().startsWith(query);
                let bStarts = b.text.toLowerCase().startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return a.text.localeCompare(b.text);
            }).slice(0, 10);

            if (results.length > 0) {
                this._showResults(results);
            } else {
                this._hideResults();
            }
        },

        _handleKeydown: function(e) {
            if (e.keyCode === 13) { // Enter
                const firstResult = this._resultsContainer.firstChild;
                if (firstResult) {
                    firstResult.click();
                }
            }
        },

        _showResults: function(results) {
            this._resultsContainer.innerHTML = '';
            this._resultsContainer.style.display = 'block';
            results.forEach(result => {
                const div = L.DomUtil.create('div', 'leaflet-search-result', this._resultsContainer);
                // Add type indicator
                let typeLabel = result.type === 'map' ? ' <span style="font-size: 0.8em; color: #888;">(Map)</span>' : '';
                div.innerHTML = result.text + typeLabel;
                L.DomEvent.on(div, 'click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    this._selectResult(result);
                });
            });
        },

        _hideResults: function() {
            this._resultsContainer.style.display = 'none';
        },

        _handleOutsideClick: function(e) {
            if (e.target !== this._input) {
                this._hideResults();
            }
        },

        _selectResult: function(result) {
            this._input.value = result.text;
            this._hideResults();
            
            if (result.mapId !== undefined) {
                if (this._map.setMapId) {
                    this._map.setMapId(result.mapId);
                }
            }

            const loc = result.location;
            if (this._map.setPlane && loc.plane !== undefined) {
                this._map.setPlane(loc.plane);
            }
            
            this._map.flyTo([loc.y, loc.x], 4);
        }
    });

    L.Map.addInitHook(function() {
        if (this.options.searchControl) {
            this.searchControl = new L.Control.Search(this.options.searchControl === true ? {} : this.options.searchControl);
            this.addControl(this.searchControl);
        }
    });

    L.control.search = function (options) {
        return new L.Control.Search(options);
    };
});
