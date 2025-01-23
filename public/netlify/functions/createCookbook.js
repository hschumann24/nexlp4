const { PDFDocument, rgb } = require('pdf-lib'); // Example library for PDF generation

exports.handler = async (event, context) => {
    try {
        // Ensure the request is a POST
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                body: JSON.stringify({ error: 'Method Not Allowed' }),
            };
        }

        // Parse the request body
        const { items } = JSON.parse(event.body);

        if (!items || items.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No items provided' }),
            };
        }

        // Create a new PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 800]);
        const { width, height } = page.getSize();

        // Add personalized content to the PDF
        let y = height - 50;
        page.drawText('Personalized Cookbook', {
            x: 50,
            y,
            size: 24,
            color: rgb(0, 0, 0),
        });

        y -= 40;
        items.forEach((item, index) => {
            page.drawText(`${index + 1}. ${item.favoriteCuisines || 'No cuisines provided'}`, {
                x: 50,
                y,
                size: 12,
                color: rgb(0, 0, 0),
            });
            y -= 20;
        });

        // Save the PDF and return it as a base64 string
        const pdfBytes = await pdfDoc.save();
        const base64PDF = Buffer.from(pdfBytes).toString('base64');

        // Respond with the PDF download link (example URL)
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Cookbook generated successfully',
                downloadLink: `data:application/pdf;base64,${base64PDF}`, // For demonstration, this embeds the PDF directly
            }),
        };
    } catch (error) {
        console.error('Error generating cookbook:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate cookbook' }),
        };
    }
};
