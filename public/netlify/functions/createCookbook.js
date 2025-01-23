const { PDFDocument, rgb } = require('pdf-lib'); // Example library for PDF generation
const fetch = require('node-fetch'); // For making API calls
const AWS = require('aws-sdk'); // AWS SDK for S3 storage

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Update with proper variable
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Update with proper variable
    region: 'us-east-1', // Replace with your bucket's region
});


// OpenAI API key (set this as an environment variable)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

        if (!openAIResponse.ok) {
            throw new Error(`OpenAI API error: ${openAIResult.error.message}`);
        }

        const generatedContent = openAIResult.choices[0].message.content.trim();

        // Create a new PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 800]);
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
                page = pdfDoc.addPage([600, 800]);
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

        // Respond with the S3 link
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Cookbook generated successfully',
                downloadLink: s3Result.Location,
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
