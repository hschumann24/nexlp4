import json
import boto3
import openai
from fpdf import FPDF

# Configure AWS S3
s3 = boto3.client(
    's3',
    aws_access_key_id="aws-access-keys-id",  # Replace with your environment variable
    aws_secret_access_key="aws-secret-access-keys",  # Replace with your environment variable
    region_name="us-east-1"  # Replace with your bucket region
)

# OpenAI API key
openai.api_key = "openai_api_key"  # Replace with your environment variable


def handler(event, context):
    try:
        # Ensure the request is POST
        if event["httpMethod"] != "POST":
            return {
                "statusCode": 405,
                "body": json.dumps({"error": "Method Not Allowed"}),
            }

        # Parse the request body
        body = json.loads(event["body"])
        items = body.get("items", [])

        if not items:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "No items provided"}),
            }

        # Create a prompt for OpenAI
        prompt = "You are a professional chef creating personalized cookbooks. Generate a detailed cookbook based on the following details. Include recipes categorized by meal types (e.g., Breakfast, Lunch, Dinner, Dessert) and ensure the cookbook has a professional format:\n"
        for index, item in enumerate(items):
            prompt += f"""
# {index + 1}
Favorite Cuisines: {item.get('favoriteCuisines', 'None')}
Dietary Restrictions: {', '.join(item.get('dietaryRestrictions', [])) or 'None'}
Disliked Foods: {item.get('dislikedFoods', 'None')}
Cooking Skill Level: {item.get('cookingSkill', 'None')}
Favorite Fruits: {', '.join(item.get('favoriteFruits', [])) or 'None'}
Favorite Meats: {', '.join(item.get('favoriteMeats', [])) or 'None'}
Favorite Spices: {', '.join(item.get('favoriteSpices', [])) or 'None'}
"""

        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a professional chef."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=1500,
        )

        generated_content = response["choices"][0]["message"]["content"].strip()

        # Generate a PDF with FPDF
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        pdf.cell(200, 10, txt="Personalized Cookbook", ln=True, align="C")
        pdf.ln(10)

        for line in generated_content.split("\n"):
            pdf.multi_cell(0, 10, txt=line)

        # Save PDF to bytes
        pdf_output = f"cookbook-{int(time.time())}.pdf"
        pdf_bytes = pdf.output(dest="S").encode("latin1")

        # Upload PDF to S3
        bucket_name = "naraloom-project-2023-example.0002"  # Replace with your bucket name
        s3.put_object(
            Bucket=bucket_name,
            Key=pdf_output,
            Body=pdf_bytes,
            ContentType="application/pdf",
            ACL="public-read",
        )

        # Generate S3 download link
        s3_url = f"https://{bucket_name}.s3.amazonaws.com/{pdf_output}"

        # Respond with the S3 link
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Cookbook generated successfully",
                "downloadLink": s3_url
            }),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Failed to generate cookbook", "details": str(e)}),
        }