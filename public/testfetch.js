const fetch = require('node-fetch');

exports.handler = async () => {
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        });
        const data = await response.json();
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Fetch error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
