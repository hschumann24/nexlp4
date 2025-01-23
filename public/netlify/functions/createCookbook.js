const { PDFDocument, rgb } = require('pdf-lib'); // For PDF generation
const fetch = require('node-fetch'); // Correctly importing fetch
const AWS = require('aws-sdk'); // AWS SDK for S3 storage

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEYS_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEYS,
    region: 'us-east-1',
});

// OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

exports.handler = async (event, context) => {
    try {
        console.log("Starting cookbook generation...");

        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                body: JSON.stringify({ error: 'Method Not Allowed' }),
            };
        }

        const { items } = JSON.parse(event.body);
        if (!items || items.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No items provided' }),
            };
        }

        const prompt = `You are a professional chef...`; // Use your full prompt here
        console.log("Generated prompt for OpenAI:", prompt);

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

        if (!openAIResponse.ok) {
            throw new Error(`OpenAI API error: ${await openAIResponse.text()}`);
        }

        const openAIResult = await openAIResponse.json();
        const generatedContent = openAIResult.choices[0].message.content.trim();
        if (!generatedContent) throw new Error("OpenAI generated content is empty");

        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([600, 800]);
        const { width, height } = page.getSize();
        let y = height - 50;
        page.drawText('Personalized Cookbook', { x: 50, y, size: 24, color: rgb(0, 0, 0) });
        y -= 40;
        const lines = generatedContent.split('\n');
        lines.forEach((line) => {
            if (y < 50) {
                page = pdfDoc.addPage([600, 800]);
                y = height - 50;
            }
            page.drawText(line, { x: 50, y, size: 12, color: rgb(0, 0, 0) });
            y -= 20;
        });

        const pdfBytes = await pdfDoc.save();
        if (!pdfBytes) throw new Error("PDF generation failed");

        const fileName = `cookbook-${Date.now()}.pdf`;
        const s3Params = {
            Bucket: 'naraloom-project-2023-example.0002',
            Key: fileName,
            Body: Buffer.from(pdfBytes),
            ContentType: 'application/pdf',
            ACL: 'public-read',
        };

        const s3Result = await s3.upload(s3Params).promise();
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
            body: JSON.stringify({ error: 'Failed to generate cookbook', details: error.message }),
        };
    }
};
