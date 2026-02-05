'use strict';

export const RS_TILE_WIDTH_PX = 0;
export const RS_TILE_HEIGHT_PX = 0;

export class Position {

    constructor(x, y, z) {
        this.x = Math.round(x);
        this.y = Math.round(y);
        this.z = z;
    }

    static fromLatLng(map, latLng, z) {
        return new Position(latLng.lng, latLng.lat, z);
    }

    toLatLng(map) {
        return L.latLng(this.y, this.x);
    }

    toCentreLatLng(map) {
        return L.latLng(this.y + 0.5, this.x + 0.5);
    }

    static toLatLng(map, x, y) {
        return L.latLng(y, x);
    }

    getDistance(position) {
        var diffX = Math.abs(this.x - position.x);
        var diffY = Math.abs(this.y - position.y);
        return Math.sqrt((diffX * diffX) + (diffY * diffY));
    }

    toLeaflet(map) {
        var startLatLng = this.toLatLng(map)
        var endLatLng = new Position(this.x + 1, this.y + 1, this.z).toLatLng(map)

        return L.rectangle(L.latLngBounds(startLatLng, endLatLng), {
            color: "#33b5e5",
            fillColor: "#33b5e5",
            fillOpacity: 1.0,
            weight: 1,
            interactive: false
        });
    }

    getName() {
        return "Position";
    }

    equals(position) {
        return this.x === position.x && this.y === position.y && this.z === position.z;
    }

    toString() {
        return `(${this.x}, ${this.y}, ${this.z})`;
    }
};
