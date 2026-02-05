'use strict';

import {Position} from '../model/Position.js';
import {Area} from '../model/Area.js';
import {Path} from '../model/Path.js';
import {Areas} from '../model/Areas.js';
import {PolyArea} from '../model/PolyArea.js';

export var CollectionControl = L.Control.extend({    
    options: {
        position: 'topleft'
    },

    onAdd: function (map) {
        this._path = new Path(this._map);
        this._areas = new Areas(this._map);
        this._polyArea = new PolyArea(this._map);

        this._currentDrawable = undefined;
        this._currentConverter = undefined;

        this._prevMouseRect = undefined;
        this._prevMousePos = undefined;

        this._firstSelectedAreaPosition = undefined;
        this._drawnMouseArea = undefined;    
        this._editing = false;

        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control noselect');
        container.style.background = 'white'; // Explicit background for visibility
        container.style.width = '70px';
        container.style.height = 'auto';

        // Copy to clipboard control
        // this._createControl('<i class="fa fa-copy"></i>', container, function(e) {
        this._createControl('&#128203;', container, function(e) {
            this._copyCodeToClipboard();
        });

        // Settings control (stubbed/hidden if panel missing, but keeping logic)
        // this._createControl('<i class="fa fa-cog"></i>', container, function(e) {
        this._createControl('&#9881;', container, function(e) {
            // Checks for settings-panel presence before acting to avoid errors
            if ($("#settings-panel").length) {
                if ($("#settings-panel").is(":visible")) {
                    $("#settings-panel").hide();
                    // JQuery UI slide effect removed for compatibility
                } else {
                    if (this._currentDrawable !== undefined) {
                        this._toggleCollectionMode();
                    }
                    $("#settings-panel").css('display', 'flex').show();
                }
            } else {
                console.log("Settings panel not found");
            }
        });

        // Area control
        this._createControl('<img src="images/area-icon.png" alt="Area" title="Area" style="width: 30px; height: 30px;">', container, function(e) {
            this._toggleCollectionMode(this._areas, "areas_converter", e.target);
        });        

        // Poly Area control
        this._createControl('<img src="images/polyarea-icon.png" alt="Poly Area" title="Poly Area" style="width: 30px; height: 30px;">', container, function(e) {
            this._toggleCollectionMode(this._polyArea, "polyarea_converter", e.target);
        });

        // Path control
        this._createControl('<img src="images/path-icon.png" alt="Path" title="Path" style="width: 30px; height: 30px;">', container, function(e) {
            this._toggleCollectionMode(this._path, "path_converter", e.target);
        });

        // Undo control
        // this._createControl('<i class="fa fa-undo" aria-hidden="true"></i>', container, function(e) {
        this._createControl('&#8617;', container, function(e) {
            if (this._currentDrawable !== undefined) {
                this._currentDrawable.removeLast();
                this._outputCode();
            }
        });

        // Clear control
        // this._createControl('<i class="fa fa-trash" aria-hidden="true"></i>', container, function(e) {
        this._createControl('&#128465;', container, function(e) {
            if (this._currentDrawable !== undefined) {
                this._currentDrawable.removeAll();
                this._outputCode();
            }
        });

        L.DomEvent.disableClickPropagation(container);

        L.DomEvent.on(this._map, 'click', this._addPosition, this);

        L.DomEvent.on(this._map, 'mousemove', this._drawMouseArea, this);

        var context = this;
        // JQuery listeners - assuming JQuery is present or will be added
        if (window.jQuery) {
             $("#output-type").on('change', () => context._outputCode());
             $("#code-output").on('input propertychange paste', () => context._loadFromText());
             $("#bot-api").on('change', () => context._outputCode());
        }

        return container;
    },
    
    _createControl: function(html, container, onClick) {
        var control = L.DomUtil.create('a', 'leaflet-control-custom', container);
        control.innerHTML = html;
        control.href = '#';

        // Styles are now handled by CSS (.leaflet-control-custom)
        
        L.DomEvent.on(control, 'click', L.DomEvent.stop)
                  .on(control, 'click', onClick, this);
    },

    _addPosition: function(e) {
        if (!this._editing) {
            return;
        }

        var position = Position.fromLatLng(this._map, e.latlng, this._map.plane || 0);

        if (this._currentDrawable instanceof Areas) {
            if (this._firstSelectedAreaPosition === undefined) {
                this._firstSelectedAreaPosition = position;
            } else {
                this._map.removeLayer(this._drawnMouseArea);
                this._areas.add(new Area(this._firstSelectedAreaPosition, position));
                this._firstSelectedAreaPosition = undefined;
                this._outputCode();
            }
        } else {
            this._currentDrawable.add(position);
            this._outputCode();
        }
    },

    _drawMouseArea: function(e) {
        if (!this._editing) {
            return;
        }

        var mousePos = Position.fromLatLng(this._map, e.latlng, this._map.plane || 0);

        if (this._currentDrawable instanceof Areas) {
            if (this._firstSelectedAreaPosition !== undefined) {

                if (this._drawnMouseArea !== undefined) { 
                    this._map.removeLayer(this._drawnMouseArea);
                }

                this._drawnMouseArea = new Area(this._firstSelectedAreaPosition, mousePos).toLeaflet(this._map);
                this._drawnMouseArea.addTo(this._map);
            }
        } else if (this._currentDrawable instanceof PolyArea) {
            if (this._drawnMouseArea !== undefined) { 
                this._map.removeLayer(this._drawnMouseArea);
            }
            
            this._drawnMouseArea = new PolyArea(this._map);
            this._drawnMouseArea.addAll(this._currentDrawable.positions);
            this._drawnMouseArea.add(mousePos);
            this._drawnMouseArea = this._drawnMouseArea.toLeaflet(this._map);
            this._drawnMouseArea.addTo(this._map);
        }
    },

    _toggleCollectionMode: function(drawable, converter, element) {
        // Simple class toggle using JS or JQuery if available
        if (window.jQuery) {
             $("a.leaflet-control-custom.active").removeClass("active");
        }

        if (this._currentDrawable === drawable || drawable === undefined) {
            this._editing = false;

            if (window.jQuery) $("#code-output-panel").hide();

            this._firstSelectedAreaPosition = undefined;
            if (this._currentDrawable && this._currentDrawable.featureGroup) {
                 this._map.removeLayer(this._currentDrawable.featureGroup);
            }

            if (this._drawnMouseArea !== undefined) {
                this._map.removeLayer(this._drawnMouseArea);
            }
            
            this._currentDrawable = undefined;
            this._currentConverter = undefined;
            
            this._outputCode();
            return;
        }

        if (window.jQuery && $("#settings-panel").length && $("#settings-panel").is(":visible")) {
            $("#settings-panel").hide();
        }

        this._editing = true;
        // Logic to add active class to clicked element's parent
        if (element && element.closest && element.closest("a")) {
             // Basic JS class manipulation if JQuery fails or just for robustness
             element.closest("a").classList.add("active");
        }
        
        this._currentConverter = converter;

        if (window.jQuery) $("#code-output-panel").show();

        if (this._currentDrawable !== undefined && this._currentDrawable.featureGroup) {
            this._map.removeLayer(this._currentDrawable.featureGroup);
        }

        this._firstSelectedAreaPosition = undefined;

        if (this._drawnMouseArea !== undefined) {
            this._map.removeLayer(this._drawnMouseArea);
        }

        this._currentDrawable = drawable;

        if (this._currentDrawable !== undefined && this._currentDrawable.featureGroup) {
            this._map.addLayer(this._currentDrawable.featureGroup);
        }

        this._outputCode();
    },

    _outputCode: function() {        
        var output = "";

        if (this._currentDrawable !== undefined) {
            // Simplified export: JSON representation of positions
            if (this._currentDrawable.areas) {
                 // Areas
                 output = JSON.stringify(this._currentDrawable.areas.map(a => ({
                     start: a.startPosition,
                     end: a.endPosition
                 })), null, 2);
            } else if (this._currentDrawable.positions) {
                 // PolyArea or Path
                 output = JSON.stringify(this._currentDrawable.positions, null, 2);
            }
        }

        if (window.jQuery) {
             $("#code-output").html("<pre>" + output + "</pre>");
        } else {
             console.log("Output:", output);
        }
    },
    
    _loadFromText: function() {
        // Stub: Not implementing import yet
    },

    _copyCodeToClipboard: function() {
        if (!window.jQuery) return;
        
        var $temp = $("<textarea>");
        $("body").append($temp);
        $temp.val($("#code-output").text()).select();
        document.execCommand("copy");
        $temp.remove();

        alert("Copied to clipboard");
    }
});
