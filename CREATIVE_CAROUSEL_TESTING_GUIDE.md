# Creative Instagram Carousel Flow - Testing Guide

## Implementation Complete ✅

All 7 implementation tasks have been completed:
- ✅ Updated automation prompt with new Step 2 (Visual Style) and Step 7 (Text Layout)
- ✅ Added Claude orchestrator functions for Steps 2 and 7
- ✅ Rewrote imageGenerator.mjs for GPT Image 2 with visual-only prompts
- ✅ Rewrote figmaIntegration.mjs for image upload and text overlay assembly
- ✅ Updated carouselGeneration.mjs to orchestrate 7 steps
- ✅ Updated database schema to support 7 steps and new step names
- ✅ Updated frontend UI progress indicators for 7 steps

## Testing & Validation Tasks 🧪

The following tasks require running the system end-to-end to validate functionality:

### 1. Test GPT Image 2 Visual Generation (NO TEXT)

**Objective:** Verify that GPT Image 2 generates high-quality visuals without any text

**Test Steps:**
1. Start a carousel generation from the UI
2. Monitor Step 6 (Generate Visuals) output
3. Check database `carousel_generation_outputs` for `step_6_visuals` output
4. Download generated images from URLs in the output
5. Visually inspect each image to verify:
   - ✅ NO text, words, letters, or readable characters appear
   - ✅ HD quality (1024×1024)
   - ✅ Visuals match the theme (minimalist/bold/editorial/playful)
   - ✅ Proper negative space is preserved for text overlay
   - ✅ Icons, shapes, colors, and graphics are present as specified

**Success Criteria:**
- All images generated successfully
- Zero images contain text artifacts
- Visual quality is HD and professional
- Negative space zones are clearly identifiable
- Visual theme is consistent with Step 2 direction

**How to Debug Failures:**
- Check `imageGenerator.mjs` logs for OpenAI API errors
- Review the `enhancedPrompt` field in Step 6 output to see what was sent to GPT Image 2
- Check `revisedPrompt` field to see if OpenAI modified the prompt
- Run `validateNoTextInImages()` function to detect text-related terms

---

### 2. Test Claude Text Layout Design & Figma Assembly

**Objective:** Verify that Claude designs precise text layouts and Figma correctly overlays text on visuals

**Test Steps:**
1. Continue from Step 6 completion
2. Monitor Step 7 (Text Layout Design) output
3. Check database `carousel_generation_outputs` for `step_7_text_layout` output
4. Verify text layout structure:
   - Each slide has `textLayers` array
   - Each text layer has `position`, `typography`, `color`, `effects`
   - Typography includes `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`
   - Positions are within frame bounds (0-1080)
5. Monitor Step 8 (Figma Assembly) execution
6. Check Figma file to verify:
   - All frames created (1080×1080 each)
   - Background images placed correctly
   - Text layers positioned precisely
   - Typography settings applied correctly
   - Shadow effects visible on text for readability

**Success Criteria:**
- Step 7 generates complete text layout specifications
- All text layers have valid positions and typography
- Text is positioned in negative space zones from Step 6
- Figma assembly script runs without errors
- Final Figma file has all slides with properly positioned text
- Text contrast ratio ≥ 4.5:1 on all backgrounds

**How to Debug Failures:**
- Check `claudeOrchestrator.mjs` logs for Step 7 API errors
- Review Step 7 output JSON structure for missing fields
- Check Figma MCP logs for `upload_assets` and `use_figma` tool errors
- Manually inspect Figma file to verify text layer properties
- Run `validateTextContrast()` function to check readability

---

### 3. Validate Mayven-Style Creative Quality

**Objective:** Ensure final carousels match @mayven_____ level of sophistication

**Test Steps:**
1. Generate 3-5 complete carousels with different content types:
   - Listicle (e.g., "7 Ways to...")
   - How-to guide
   - Before/after comparison
   - Storytelling arc
2. Export final frames from Figma as PNG (2x resolution)
3. Compare against @mayven_____ Instagram posts visually
4. Evaluate each carousel on:
   - **Visual Flow:** Slides tell a cohesive story with consistent visual language
   - **Spacing:** Generous negative space, intentional breathing room
   - **Typography:** Proper hierarchy (headlines 56-96px, body 24-36px)
   - **Color:** Brand-aligned palette with strategic gradients/accents
   - **Composition:** Balanced layouts with clear focal points
   - **Sophistication:** Polished, professional, scroll-stopping quality

**Evaluation Rubric:**
Rate each carousel on a 1-5 scale for each criterion:

| Criterion | 1 (Poor) | 3 (Good) | 5 (Excellent) |
|-----------|----------|----------|---------------|
| Visual Flow | Disjointed | Somewhat cohesive | Tells clear story |
| Spacing | Cramped | Adequate | Intentional negative space |
| Typography | Inconsistent | Readable | Clear hierarchy |
| Color | Clashing | Brand-aligned | Strategic palette |
| Composition | Unbalanced | Centered | Dynamic focal points |
| Sophistication | Amateur | Professional | Scroll-stopping |

**Target Score:** Average ≥ 4.0 across all criteria

**Success Criteria:**
- All carousels score ≥ 4.0 average
- No single carousel scores < 3.0 on any criterion
- Carousels feel comparable to @mayven_____ quality
- Users say "Wow, this looks professional"

**How to Improve:**
- Adjust Step 2 (Visual Style Direction) prompts for better visual guidance
- Refine color strategy in `runStep2_VisualStyleDirection`
- Tune typography scales in Step 7 for better hierarchy
- Add more sophisticated gradient/texture options
- Increase emphasis on negative space in GPT Image 2 prompts

---

## Testing Checklist

**Environment Setup:**
```bash
# Ensure all environment variables are set
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key
FIGMA_ACCESS_TOKEN=your_token
IGEO_ACCOUNT_ID=your_account_id

# Run database migration
psql -d your_database -f db/carousel_generation_schema.sql

# Start the dev server
npm run dev
```

**Test Execution:**
1. ☐ Navigate to `/carousel` route in browser
2. ☐ Select an Instagram post
3. ☐ Start carousel generation
4. ☐ Monitor console logs for all 7 steps
5. ☐ Check database for step outputs
6. ☐ Download generated images
7. ☐ Inspect Figma file
8. ☐ Export final frames
9. ☐ Evaluate against mayven quality

**Documentation:**
- Screenshot each step's output
- Save generated image URLs
- Record Figma file URL
- Note any errors or warnings
- Document quality scores

---

## Expected Outcomes

**Step 1: Content Plan**
```json
{
  "carouselType": "listicle",
  "slideCount": 7,
  "visualComplexity": "medium",
  "designTheme": "bold"
}
```

**Step 2: Visual Style Direction**
```json
{
  "visualTheme": "bold",
  "colorStrategy": {
    "primary": "#FF6B6B",
    "secondary": "#4ECDC4",
    "accent": "#FFE66D",
    "background": "gradient",
    "gradientDirection": "vertical"
  },
  "perSlideVisuals": [...]
}
```

**Step 6: Generated Visuals**
```json
{
  "imageModel": "gpt-image-2",
  "quality": "hd",
  "images": [
    {
      "slideIndex": 1,
      "status": "generated",
      "assetRef": "https://...",
      "negativeSpaceZones": "top and left"
    }
  ]
}
```

**Step 7: Text Layouts**
```json
{
  "slides": [
    {
      "slideIndex": 1,
      "textLayers": [
        {
          "type": "headline",
          "content": "7 Ways to Boost Engagement",
          "position": { "x": 80, "y": 120, "width": 920 },
          "typography": {
            "fontFamily": "Inter",
            "fontSize": 72,
            "fontWeight": "700"
          }
        }
      ]
    }
  ]
}
```

**Step 8: Figma Assembly**
```json
{
  "slideCount": 7,
  "uploadedAssets": 7,
  "figmaScript": "...",
  "mcpCall": {
    "tool": "use_figma",
    "params": {...}
  }
}
```

---

## Troubleshooting

### Issue: GPT Image 2 generates text in images
**Solution:** Strengthen NO TEXT emphasis in prompts. Add multiple variations:
```javascript
prompt += `CRITICAL: Absolutely no text, no words, no letters, no readable characters. `;
prompt += `NO TEXT ALLOWED. Only visual elements. `;
prompt += `This is critical: ZERO text in the image. `;
```

### Issue: Text layers positioned incorrectly
**Solution:** Improve Step 7 prompt to analyze negative space more carefully. Provide explicit coordinates based on visual analysis.

### Issue: Figma assembly fails
**Solution:** 
1. Check Figma MCP authentication
2. Verify font names are valid (use `figma.listAvailableFontsAsync()`)
3. Ensure image hashes are valid from upload step
4. Test with smaller batch (single slide first)

### Issue: Low creative quality scores
**Solution:**
1. Study @mayven_____ account for pattern recognition
2. Extract common visual techniques (color palettes, spacing ratios, typography scales)
3. Update Step 2 prompts with specific mayven-inspired guidelines
4. Add more sophisticated composition options
5. Increase GPT Image 2 prompt detail for richer visuals

---

## Next Steps After Testing

1. **Optimize Performance:** If generation takes > 3 minutes, optimize API calls or parallelize steps
2. **Add User Feedback:** Collect user ratings on generated carousels
3. **Build Template Library:** Extract successful patterns into reusable templates
4. **A/B Testing:** Test different visual themes and measure engagement
5. **Scale to Other Platforms:** Adapt flow for LinkedIn carousels, Pinterest pins, etc.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Generation Time | ≤ 3 minutes | End-to-end completion time |
| Visual Quality | 100% HD, 0% text | Image inspection |
| Text Precision | 100% positioned correctly | Figma verification |
| Creative Quality | ≥ 4.0/5.0 average | Evaluation rubric |
| User Satisfaction | ≥ 90% approve | User feedback survey |
| Error Rate | < 5% | Failed generations / total |

---

## Contact & Support

- For implementation questions: Check code comments in each module
- For Claude API issues: Review `claudeOrchestrator.mjs` logs
- For OpenAI API issues: Review `imageGenerator.mjs` logs
- For Figma MCP issues: Check Figma plugin console and MCP logs
- For database issues: Query `carousel_generations` and `carousel_generation_outputs` tables

**Happy Testing! 🎨✨**
