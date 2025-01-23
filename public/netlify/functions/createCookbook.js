const { PDFDocument, rgb } = require('pdf-lib'); // For PDF generation
const fetch = require('node-fetch'); // Correctly importing fetch
const AWS = require('aws-sdk'); // AWS SDK for S3 storage

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEYS_ID, // Set in environment variables
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEYS, // Set in environment variables
    region: 'us-east-1', // Replace with your bucket's region
});

// OpenAI API key (set this as an environment variable)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

exports.handler = async (event, context) => {
    try {
        console.log("Starting cookbook generation...");

        // Ensure the request is a POST
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                body: JSON.stringify({ error: 'Method Not Allowed' }),
            };
        }

        // Parse the request body
        const { items } = JSON.parse(event.body);
        console.log("Parsed items:", items);

        if (!items || items.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No items provided' }),
            };
        }

        // Create a prompt for ChatGPT
        const prompt = `You are a professional chef creating personalized cookbooks. Generate a detailed cookbook based on the following details. Include recipes categorized by meal types (e.g., Breakfast, Lunch, Dinner, Dessert) and ensure the cookbook has a professional format:
${items.map((item, index) => {
    return `
#${index + 1}
Favorite Cuisines: ${item.favoriteCuisines || 'None'}
Dietary Restrictions: ${item.dietaryRestrictions ? item.dietaryRestrictions.join(', ') : 'None'}
Disliked Foods: ${item.dislikedFoods || 'None'}
Cooking Skill Level: ${item.cookingSkill || 'None'}
Favorite Fruits: ${item.favoriteFruits ? item.favoriteFruits.join(', ') : 'None'}
Favorite Meats: ${item.favoriteMeats ? item.favoriteMeats.join(', ') : 'None'}
Favorite Spices: ${item.favoriteSpices ? item.favoriteSpices.join(', ') : 'None'}
`;
}).join('\n')}`;

        console.log("Generated prompt for OpenAI:", prompt);

        // Call the OpenAI API
        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'system', content: 'You are a professional chef.' }, { role: 'user', content: prompt }],
                max_tokens: 1500,
            }),
        });

        const openAIResult = await openAIResponse.json();
        console.log("OpenAI API response:", openAIResult);

        if (!openAIResponse.ok) {
            throw new Error(`OpenAI API error: ${openAIResult.error.message}`);
        }

        const generatedContent = openAIResult.choices[0].message.content.trim();
        console.log("Generated content from OpenAI:", generatedContent);

        // Create a new PDF
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([600, 800]); // Change const to let
        const { width, height } = page.getSize();

        // Add content to the PDF
        let y = height - 50;
        page.drawText('Personalized Cookbook', {
            x: 50,
            y,
            size: 24,
            color: rgb(0, 0, 0),
        });

        y -= 40;
        const lines = generatedContent.split('\n');
        lines.forEach((line) => {
            if (y < 50) {
                // Create a new page and reset y-coordinate
                page = pdfDoc.addPage([600, 800]); // Reassign page for the new page
                y = height - 50;
            }
            page.drawText(line, {
                x: 50,
                y,
                size: 12,
                color: rgb(0, 0, 0),
            });
            y -= 20;
        });

        // Save the PDF to a buffer
        const pdfBytes = await pdfDoc.save();

        if (!pdfBytes || pdfBytes.length === 0) {
            throw new Error("PDF generation failed. Buffer is empty.");
        }

        console.log("PDF generated successfully. Uploading to S3...");

        // Upload the PDF to S3
        const fileName = `cookbook-${Date.now()}.pdf`;
        const s3Params = {
            Bucket: 'naraloom-project-2023-example.0002', // Replace with your S3 bucket name
            Key: fileName,
            Body: Buffer.from(pdfBytes),
            ContentType: 'application/pdf',
            ACL: 'public-read',
        };

        const s3Result = await s3.upload(s3Params).promise();
        console.log("S3 upload successful:", s3Result);

        // Respond with the S3 link
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Cookbook generated successfully',
                downloadLink: s3Result.Location,
            }),
        };
    } catch (error) {
        console.error('Error generating cookbook:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
        });
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate cookbook', details: error.message }),
        };
    }
};
