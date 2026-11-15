# AstraHealth: NASA Space Apps Challenge 2026 submission

Challenge: **Create Health Monitoring Software for Astronauts on Space Missions**

Text for the "Use of Super Intelligence (SI)" question of the submission form. The full SI declaration is in the README.

## Use of Super Intelligence (SI)

SI tools were used to build AstraHealth, and every use is identified in the project:

- **Code:** written with SI coding assistants, directed, reviewed and tested by the team. Claude Code (Anthropic) wrote the backend, data, health rules engine, database, server, AI and SOS logic, and the 3D generator. OpenAI Codex/ChatGPT wrote the frontend UI. This is acknowledged in the README (SI use section), the machine-readable `docs/si-metadata.json`, `package.json`, the `index.html` meta tags and the app's login page and footer.
- **Images:** the human body figure, the journey artwork and the five organ reference images are SI-generated. They show a visible "SI-generated" watermark wherever they appear in the app and carry SI metadata in the files. The 3D organ models were built from these images by SI-written code; they are watermarked "SI-generated 3D" and their GLB metadata says so.
- **Data:** all health data is simulated by SI-written code; no real astronaut data is used.
- **Runtime AI:** the medical briefing, photo first look and file extraction are produced live by Google Gemini and labelled "AI briefing (SI-generated)" and "AI first look (SI-generated text)". Offline rules take over when it is unavailable.
- **Audio:** none.
- **NASA branding:** no NASA logos, flags, patches or mission identifiers are used or modified in any generated content.
