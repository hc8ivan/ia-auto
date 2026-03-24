# Despliegue en la nube (gratis o casi)

## Importante: SQLite en hosting gratis

En **Render**, **Railway** (plan hobby), etc., el disco suele ser **efímero**: al redeploy o a veces al reiniciar, **`data/chat.db` se puede perder** (reservas y chats).

- **Pruebas / demo:** suele valer.
- **Producción real:** usa disco persistente de pago, **Turso** (SQLite remoto), **PostgreSQL** (Neon/Supabase gratis) o un VPS (Oracle Cloud “Always Free”, etc.).

---

## Opción A — Render.com (simple)

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
