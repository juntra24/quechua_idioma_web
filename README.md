# Aprende Quechua — Deploy

Resumen:
- Frontend: GitHub Pages (https://juntra24.github.io/)
- Backend: Render (https://quechua-idioma-web.onrender.com) -> server.js
- Ollama: debe estar disponible para el backend en OLLAMA_URL (por ejemplo http://127.0.0.1:11434)

Pasos rápidos (local -> GitHub):
1. Asegúrate de no tener `node_modules` ni `.env` en el repo (usamos .gitignore).
2. Inicializa git si hace falta:
   git init
   git add .
   git commit -m "Initial commit"
3. Crea repo en GitHub y sube:
   git remote add origin https://github.com/juntra24/REPO.git
   git branch -M main
   git push -u origin main

Publicar frontend en GitHub Pages:
- Opción simple: en la configuración del repo activa GitHub Pages desde la rama `main` y carpeta `/` o usa rama `gh-pages`.
- Si usas `gh-pages` npm tool, instala y configura.

Desplegar backend en Render:
1. En Render crea un nuevo Web Service apuntando a tu repo.
2. Build command: `npm ci`
3. Start command: `npm start`
4. En Environment setea:
   - FRONTEND_URL=https://juntra24.github.io
   - OLLAMA_URL=http://127.0.0.1:11434  (o la URL donde corre Ollama)
   - PORT no es necesario (Render asigna)
5. Si quieres ejecutar Ollama en la misma instancia: usa un servicio Docker que arranque Ollama y Node juntos (te puedo generar Dockerfile si lo deseas).

Pruebas:
- Abrir https://juntra24.github.io/chatbot.html -> el frontend llamará a https://quechua-idioma-web.onrender.com/chat
- Revisar Network y logs del servicio en Render.

Seguridad:
- Nunca subas claves ni `node_modules`.
- Restringe CORS a FRONTEND_URL en server.js (ya implementado).
