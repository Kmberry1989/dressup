# Cosplay Compass 🧭
**Cosplay Compass** is a high-fashion creative tool built for **Google Flow**. It allows users to design custom gala-inspired cosplay, animate cinematic runway walks, and curate shopping lists for luxury materials.
## 🚀 Environment Note
This application is a **Flow Tool**. It is designed to run within the Google Flow host environment. 
### Functionality Dependencies:
- **AI Models:** Image and video generation are powered by the `flow-sdk` which communicates with Flow's hosted models (e.g., `Omni 1.1 Flash`, `🍌 Nano Banana Pro`).
- **Media Access:** The tool uses `Flow.media.select()` to access the user's Flow Media Gallery.
- **Persistence:** Generated looks and videos are automatically saved back to the Flow environment.
## 🛠️ Structure
- `App.tsx`: Main studio interface and generation logic.
- `types.ts`: Application state and data definitions.
- `components/Primitives.tsx`: Elegant obsidian and gold UI components.
## 📦 Hosting on GitHub
1. Create a new repository on GitHub.
2. Push these files to the `main` branch.
3. In **Google Flow**, you can load this tool by providing the URL to the hosted `App.tsx` or using the developer manifest.
*Note: Hosting this as a standalone web page (e.g., GitHub Pages) will render the UI, but the SDK features (Generation, Media Selection) will only activate when running inside the Flow host.*
