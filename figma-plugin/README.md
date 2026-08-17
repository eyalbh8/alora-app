# Alora Carousel Importer - Figma Plugin

This Figma plugin imports Alora-generated Instagram carousels into your Figma file.

## Development Setup

1. Install dependencies:
```bash
cd figma-plugin
npm install
```

2. Build the plugin:
```bash
npm run build
```

This will compile TypeScript and output to `dist/` folder.

## Installation in Figma

1. In Figma Desktop, go to Menu > Plugins > Development > Import plugin from manifest...
2. Select the `dist/manifest.json` file from the `figma-plugin/dist` folder
3. The plugin will now appear in your Plugins menu

## Usage

1. In Alora web app, complete a carousel generation
2. Click "Send to Figma" to create an import job
3. Copy the 8-character import code
4. In Figma, open the file where you want to import the carousel
5. Run the Alora Carousel Importer plugin (Menu > Plugins > Development > Alora Carousel Importer)
6. Paste the import code and click "Import Carousel"
7. The plugin will create a new page with editable frames for each slide

## How It Works

1. **Claim Job**: The plugin uses the import code to claim the generation job from Alora API
2. **Create Page**: Creates a new Figma page named with the carousel title and date
3. **Create Frames**: Creates 1080x1350 Instagram portrait frames for each slide
4. **Import Images**: Downloads and imports slide background images
5. **Add Text**: Adds text layers from Step 7 (text layout design) output
6. **Export**: Exports frames as PNGs
7. **Complete**: Sends the Figma file URL and exported slides back to Alora

## Architecture

- `src/code.ts`: Main plugin code (runs in Figma plugin sandbox)
- `ui.html`: Plugin UI (runs in iframe)
- `manifest.json`: Plugin configuration

## API Endpoints Used

- `POST /api/carousel/figma/claim` - Claim job with import code
- `POST /api/carousel/figma/status` - Update job status
- `POST /api/carousel/figma/complete` - Complete job with assets
- `GET /api/carousel/assets/:generationId/:filename` - Fetch slide images

## Notes

- The plugin requires network access to fetch generation data and images from Alora
- Import codes expire after 24 hours
- Each import code can only be used once
- The plugin creates editable Figma frames, so you can modify text, colors, and layout after import
