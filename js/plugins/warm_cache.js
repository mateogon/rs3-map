export function warmCache() {
    if (!('serviceWorker' in navigator)) return;

    // Wait a moment after load to not compete with initial render
    setTimeout(() => {
        console.log("🔥 Warming cache for low zoom levels...");
        
        const mapId = -1;
        const plane = 0;
        const baseUrl = "https://cdn.jsdelivr.net/gh/mejrs/layers_rs3@master/map_squares";
        
        // Priority list of tiles to fetch (Zoom -4 and -3)
        // Zoom -4 is critical for "zoom out" view.
        // Based on observation: x/y range roughly -4 to 4 covering the world
        const zooms = [-4, -3]; 

        let count = 0;

        zooms.forEach(z => {
            // Precise bounds to avoid 403s
            // Z-4: x=0..1, y=0..3 (Verified)
            // Z-3: x=0..3, y=0..7 (Verified)
            const maxX = z === -4 ? 1 : 3;
            const maxY = z === -4 ? 3 : 7;

            for (let x = 0; x <= maxX; x++) {
                for (let y = 0; y <= maxY; y++) {
                    const url = `${baseUrl}/${mapId}/${z}/${plane}_${x}_${y}.png`;
                    
                    // Fetch with low priority to fill SW cache
                    // Suppress 403/404 errors in console by handling rejection
                    fetch(url, { mode: 'cors', priority: 'low' })
                            // ignore errors (404s are expected for empty space)
                        });
                    count++;
                }
            }
        });
        
        console.log(`🔥 Scheduled ${count} low-zoom tiles for background warming.`);
    }, 3000);
}
