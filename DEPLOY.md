# Despliegue en la nube (gratis o casi)

## Importante: SQLite en hosting gratis

En **Render**, **Railway** (plan hobby), etc., el disco suele ser **efímero**: al redeploy o a veces al reiniciar, **`data/chat.db` se puede perder** (reservas y chats).

- **Pruebas / demo:** suele valer.
- **Producción real:** usa disco persistente de pago, **Turso** (SQLite remoto), **PostgreSQL** (Neon/Supabase gratis) o un VPS (Oracle Cloud “Always Free”, etc.).

---

## Despliegue rápido en Render (repo ya en GitHub)

Repo: [github.com/hc8ivan/ia-auto](https://github.com/hc8ivan/ia-auto).

1. Entra en [render.com](https://render.com) e inicia sesión con GitHub.
2. **New → Blueprint** → autoriza el repo **hc8ivan/ia-auto** si te lo pide → elige la rama **main** (detectará `render.yaml`).
3. Antes de aplicar el despliegue, en **Environment** del servicio `ia-auto` añade **`OPENAI_API_KEY`** con tu clave (no se sube a git).
4. **Apply** / despliega y espera el build Docker (~5–10 min la primera vez).
5. Abre la URL `https://ia-auto.onrender.com` (o la que te asigne Render). Prueba `GET /health` y abre `/` para el chat.

Si prefieres no usar Blueprint: **New → Web Service** → mismo repo → **Runtime: Docker** → `Dockerfile` en la raíz; mismas variables de entorno y **Health check path:** `/health`.

---

## Opción A — Render.com (paso a paso manual)

1. Cuenta en [render.com](https://render.com) (GitHub/GitLab).
2. **New → Web Service** → conecta el repo (sube el proyecto a GitHub antes).
3. Configuración sugerida:
   - **Runtime:** Docker *(si el repo tiene `Dockerfile`)* **o** Node
   - Si **Node:**
     - Build: `npm install`
     - Start: `npm start`
   - **Instance type:** Free
4. **Environment variables** (pega desde tu `.env` local, **no subas** `.env` al repo):

   | Variable | Notas |
   |----------|--------|
   | `OPENAI_API_KEY` | Obligatoria |
   | `PORT` | Render inyecta `PORT`; tu app ya lo usa |
   | `NODE_ENV` | `production` |
   | `TRUST_PROXY` | `true` |
   | `CORS_ORIGIN` | URL pública de tu servicio Render o `*` al probar |
   | SMTP, `RESTAURANT_*`, `DATABASE_PATH`, etc. | Igual que en local |

5. **Health check path:** `/health`
6. Despliega. La URL será `https://tu-servicio.onrender.com`

**Free tier:** el servicio **se duerme** tras un rato sin tráfico; el primer acceso puede tardar ~1 minuto.

---

## Opción B — Docker local / Fly.io / otro

```bash
docker build -t la-terrace-assistant .
docker run -p 3000:3000 --env-file .env la-terrace-assistant
```

En **Fly.io** puedes añadir un **volume** para persistir `data/` (consulta su documentación).

---

## Checklist post-despliegue

- [ ] `GET https://tu-dominio/health` → `200` y `database: true`
- [ ] `GET https://tu-dominio/api/mail/status` → `ready: true` si quieres correos
- [ ] Chat en la raíz `/` carga y `POST /api/chat` responde
- [ ] **No** commitear `.env` ni contraseñas
