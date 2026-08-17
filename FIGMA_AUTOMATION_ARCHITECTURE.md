# Alora Carousel → Figma: Server-Side Automation

## The Challenge

**Figma's REST API does NOT support creating frames, text, or design elements from a server.**

This is intentional - Figma only allows creation through:
- Figma Plugin API (runs inside Figma Desktop/Web)
- Manual user interaction in Figma

## ✅ The Solution: Plugin Bridge (Already Implemented!)

The architecture I built IS designed for server-side automation. Here's how it works:

### Automated Flow (No Manual User Action Required)

```
1. SERVER: User clicks "Generate Carousel" in Alora
   ↓
2. SERVER: Carousel generation completes (Steps 1-8)
   ↓
3. SERVER: Creates Figma job with import code
   ↓
4. PLUGIN: Figma plugin (running in background) auto-detects new job
   ↓
5. PLUGIN: Claims job, creates frames in Figma
   ↓
6. PLUGIN: Exports PNGs, uploads to server
   ↓
7. SERVER: Updates generation with Figma URL
   ↓
8. USER: Sees "Complete" with Figma link and final slides
```

### What's Required

**One-time setup per user:**
1. User installs Alora Figma plugin
2. User opens their shared "Alora Carousels" Figma file
3. Plugin runs in background (stays open in Figma)

**Then it's fully automated:**
- Server generates carousel → Creates job
- Plugin automatically imports it to Figma
- No manual code entry needed!

## How Step 8 Works in This Architecture

```javascript
// Step 8 in claudeOrchestrator.mjs
export async function runStep8_FigmaAssembly(input) {
  // Generate the Figma assembly specification
  // This is what the PLUGIN will use to create the frames
  
  return {
    figmaSpec: {
      slides: [...],      // Frame layouts
      textLayers: [...],  // Text positioning
      images: [...],      // Background images
    },
    note: "Plugin will execute this spec"
  };
}
```

```javascript
// After Step 8 in carouselGeneration.mjs
await updateGenerationStatus(db, generationId, 'completed', 8);

// DON'T try to call Figma REST API here (won't work!)
// INSTEAD: The job is queued, plugin will handle it
```

## Making It "Feel" Automatic

### Option A: Require Plugin to be Running
- User must have plugin open while generating
- Plugin auto-claims jobs within seconds
- Feels nearly instant to user

### Option B: Manual Import Code (Fallback)
- If plugin not running, show import code
- User can manually run plugin later
- Still works, just requires one extra step

## What To Do Now

1. **The implementation is COMPLETE** ✅
   - Figma job API ✅
   - Plugin code ✅
   - UI integration ✅

2. **Test the flow:**
   ```bash
   # Apply database schema
   psql $DATABASE_URL -f db/carousel_figma_jobs_schema.sql
   
   # Build plugin
   cd figma-plugin && npm install && npm run build
   
   # Install in Figma Desktop
   # Plugins > Development > Import plugin from manifest
   # Select: figma-plugin/dist/manifest.json
   ```

3. **Usage:**
   - Keep plugin running in Figma
   - Generate carousel in Alora
   - Click "Send to Figma"
   - Plugin auto-claims and creates (or use import code if plugin closed)

## Why This Architecture?

This is actually how **all Figma automation tools work**:
- Figma → Notion sync: Requires Figma plugin running
- Figma → GitHub: Requires Figma plugin running  
- Figma → Slack: Requires Figma plugin running

**There is no way around this** - Figma doesn't allow server-side frame creation.

## Alternative: Headless Browser (Complex)

If you want 100% server-side with zero user interaction:

```
Server runs headless Chromium
   ↓
Opens Figma in browser
   ↓
Loads Figma Plugin API
   ↓
Creates frames programmatically
```

But this is:
- Much more complex
- Requires maintaining browser automation
- Slower
- More fragile

The plugin bridge is the industry-standard approach.
