/**
 * LLM Extractor - Uses Claude to extract structured data from policy text
 */

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { ExtractedPolicy, ExtractedPolicySchema } from '../types/policy';

export class ExtractionError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ExtractionError';
  }
}

const EXTRACTION_PROMPT_TEMPLATE = `You are extracting structured data from an Indian health insurance document. Return STRICT JSON matching the provided schema.

RULES:
- If a field is not explicitly stated, return null
- For each non-null field, also return a source_quote with the exact text and page number
- Do NOT infer, estimate, or assume values
- Do NOT use industry-default values
- For amounts, normalize to INR integer (₹5 lakh → 500000)
- For waiting periods, normalize to months
- Confidence: HIGH if document is full policy wording, MEDIUM if quote/CIS, LOW if scanned/illegible

Document text:
{EXTRACTED_TEXT}

Return a JSON object matching this schema:
{
  "policy_id": "string (will be generated)",
  "insurer_id": null,
  "insurer_raw_name": "string (exact name from document)",
  "product_name": "string | null",
  "document_type": "QUOTE | POLICY_WORDING | CIS | UNKNOWN",
  "sum_insured": "number | null (in INR)",
  "annual_premium": "number | null (in INR)",
  "copay_percent": "number | null",
  "deductible": "number | null",
  "room_rent_limit": "number | string | null",
  "icu_limit": "number | string | null",
  "initial_waiting_months": "number | null",
  "ped_waiting_months": "number | null",
  "specific_illness_waiting_months": "number | null",
  "maternity_waiting_months": "number | null",
  "maternity_covered": "boolean | null",
  "maternity_limit": "number | null",
  "newborn_covered": "boolean | null",
  "pre_hospitalization_days": "number | null",
  "post_hospitalization_days": "number | null",
  "daycare_procedures_count": "number | null",
  "ayush_covered": "boolean | null",
  "modern_treatments_covered": "boolean | null",
  "restoration_benefit": "boolean | null",
  "no_claim_bonus_max_pct": "number | null",
  "free_health_checkup": "boolean | null",
  "cashless_hospitals_count": "number | null",
  "sub_limits": [{"category": "string", "limit": "string"}] | null,
  "permanent_exclusions": ["string"] | null,
  "extraction_confidence": "HIGH | MEDIUM | LOW",
  "fields_missing": ["string"],
  "source_quotes": [{"field": "string", "quote": "string", "page": number}],
  "raw_text_excerpt": "string (first ~2000 chars)"
}

Return ONLY valid JSON, no markdown formatting.`;

/**
 * Extract policy data using Claude
 */
export async function extractWithLLM(
  extractedText: string,
  _pages: { pageNum: number; text: string }[]
): Promise<ExtractedPolicy> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new ExtractionError('ANTHROPIC_API_KEY not configured');
  }
  
  const anthropic = new Anthropic({ apiKey });
  
  // Truncate text if too long (Claude has token limits)
  const maxChars = 100000;
  const truncatedText = extractedText.length > maxChars
    ? extractedText.substring(0, maxChars) + '\n\n[... truncated ...]'
    : extractedText;
  
  const prompt = EXTRACTION_PROMPT_TEMPLATE
    .replace('{EXTRACTED_TEXT}', truncatedText);
  
  try {
    const startTime = Date.now();
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });
    
    const duration = Date.now() - startTime;
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    
    console.log(`LLM extraction completed in ${duration}ms (${inputTokens} in, ${outputTokens} out)`);
    
    // Extract JSON from response
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new ExtractionError('Unexpected response type from Claude');
    }
    
    let jsonText = content.text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }
    
    const parsed = JSON.parse(jsonText);
    
    // Generate policy_id
    parsed.policy_id = uuidv4();
    
    // Add raw text excerpt
    parsed.raw_text_excerpt = extractedText.substring(0, 2000);
    
    // Validate against schema
    const validated = ExtractedPolicySchema.parse(parsed);
    
    return validated;
    
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new ExtractionError(
        `Claude API error: ${error.message}`,
        { status: error.status, error: error.error }
      );
    }
    
    if (error instanceof SyntaxError) {
      throw new ExtractionError('Failed to parse LLM response as JSON', { error });
    }
    
    throw new ExtractionError(
      'LLM extraction failed',
      error instanceof Error ? { message: error.message } : error
    );
  }
}
