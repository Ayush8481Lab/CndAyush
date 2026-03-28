export default async function handler(req, res) {
    const { target } = req.query;

    if (!target) {
        return res.status(400).json({ error: 'No target URL provided' });
    }

    try {
        // Fetch data from the target site acting like a normal browser
        const response = await fetch(target, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Website returned status: ${response.status}`);
        }

        const html = await response.text();

        // Add headers to allow the frontend to read it
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        
        // Return the HTML code
        res.status(200).send(html);
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
