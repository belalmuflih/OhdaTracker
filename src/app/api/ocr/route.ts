import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert the File object to a base64 string
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = file.type;
    const base64Data = buffer.toString('base64');

    const prompt = `
      You are an expert OCR and data extraction tool.
      Analyze this receipt/invoice and extract the following information:
      - amount: The total numerical amount as a number (e.g. 15.50).
      - date: The date of the transaction in YYYY-MM-DD format.
      - description: A brief, concise description of the expense based on the items or vendor.
      - invoiceType: Look for a "Company VAT ID" or similar VAT number. If one is present, categorize as 'tax_invoice'. Otherwise, categorize as 'simplified_tax'.

      Return ONLY a JSON object exactly matching this schema:
      {
        "amount": number,
        "date": "YYYY-MM-DD",
        "description": "string",
        "invoiceType": "tax_invoice" | "simplified_tax"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          }
        }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const textResponse = response.text;
    if (!textResponse) {
        throw new Error("Failed to generate content");
    }
    const result = JSON.parse(textResponse);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('OCR Error:', error);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
