# 📊 Finanzas IEUP
## Sistema Profesional de Gestión de Finanzas
### Iglesia Evangélica Unión Pentecostal


---

## 🎯 Características Principales

✅ **Gestión Completa de Finanzas**
- Registro de ingresos (ofertas, aportes, donaciones, etc.)
- Registro de egresos con análisis de costos
- Desglose detallado de billetes para ofertas
- Saldos en múltiples monedas (ARS, USD, CLP, Plazo Fijo, Billeteras)

✅ **Centros de Costo**
- Gestión de templos
- Gestión de cajas (Jóvenes, Dorcas, General, Niños, etc.)

✅ **Sistema de Usuarios y Roles**
- Admin (Control total)
- Cobrador (Registra movimientos)
- Consulta (Solo lectura)
- Auditor (Revisa movimientos)

✅ **Funcionalidad Offline**
- Funciona sin internet
- Sincroniza automáticamente cuando hay conexión
- Usa localStorage + Supabase Realtime

✅ **Reportes y Exportación**
- Gráficos en tiempo real
- Export a CSV
- Envío a Google Sheets
- Reportes PDF

✅ **Auditoría Integrada**
- Módulo de revisores de cuenta
- Historial de cambios
- Detección de discrepancias

✅ **PWA (Progressive Web App)**
- Funciona en Android e iOS
- Se instala como app nativa
- Sincronización automática

---

## 📋 Requisitos Previos

1. **Node.js 16+** (https://nodejs.org)
2. **Cuenta en Supabase** (https://supabase.com) - GRATIS
3. **Cuenta en Netlify** (https://netlify.com) - GRATIS
4. **Cuenta en GitHub** (https://github.com) - GRATIS
5. **Git instalado** (https://git-scm.com)

---

## 🚀 PASO 1: Preparar Supabase

### 1.1 Crear proyecto en Supabase

1. Ve a https://supabase.com
2. Haz clic en "Start your project"
3. Regístrate con GitHub (fácil y rápido)
4. Crea un nuevo proyecto:
   - **Name:** `finanzas-ieup`
   - **Database Password:** Guarda una contraseña segura
   - **Region:** Selecciona la más cercana (ej: sa-east-1 para Argentina)
5. Espera a que se cree (2-3 minutos)

### 1.2 Ejecutar el schema SQL

1. En Supabase, ve a **SQL Editor** (lado izquierdo)
2. Clic en **+ New Query**
3. Copia TODO el contenido de `supabase-schema.sql`
4. Pégalo en el editor
5. Haz clic en **RUN**
6. ✅ Las tablas se crearán automáticamente

### 1.3 Obtener credenciales

1. Ve a **Settings** → **API** (lado izquierdo)
2. Copia:
   - **Project URL** (ej: `https://xxxxx.supabase.co`)
   - **anon public** key
3. Guárdalos en un lugar seguro

---

## 💻 PASO 2: Configurar Proyecto Localmente

### 2.1 Clonar o descargar archivos

**Opción A - Con Git (Recomendado):**
```bash
git clone https://github.com/ieupnet-ux/finanzas-ieup.git
cd finanzas-ieup
```

**Opción B - Descargar directamente:**
1. Descarga los archivos
2. Abre terminal en la carpeta del proyecto

### 2.2 Instalar dependencias

```bash
npm install
```

Esto descarga todas las librerías necesarias (~200MB).

### 2.3 Configurar variables de entorno

1. En la carpeta raíz, copia `.env.example` a `.env.local`
2. Abre `.env.local` y rellena:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_KEY=tu-anon-key-aqui
```

### 2.4 Probar localmente

```bash
npm run dev
```

Abre en navegador: `http://localhost:3000`

🎉 ¡Deberías ver la pantalla de login!

---

## 📱 PASO 3: Crear Primer Usuario (Admin)

### 3.1 Desde Supabase

1. Ve a **Authentication** → **Users**
2. Haz clic en **+ Add user**
3. Email: `admin@ieup.com`
4. Password: Una contraseña segura
5. Clic en **Create user**

### 3.2 Darle rol de Admin

1. Ve a **SQL Editor**
2. Ejecuta esta consulta:

```sql
UPDATE public.usuarios 
SET rol = 'admin' 
WHERE email = 'admin@ieup.com';
```

### 3.3 Iniciar sesión

1. Vuelve a http://localhost:3000
2. Email: `admin@ieup.com`
3. Password: (la que creaste)
4. ¡Entra al dashboard!

---

## 🌐 PASO 4: Deployment en Netlify

### 4.1 Preparar en GitHub

1. Crea cuenta en GitHub (si no tienes)
2. Crea nuevo repositorio:
   - Nombre: `finanzas-ieup`
   - Privado
3. Sube los archivos:

```bash
git init
git add .
git commit -m "Inicial: Sistema de finanzas IEUP"
git branch -M main
git remote add origin https://github.com/tu-usuario/finanzas-ieup.git
git push -u origin main
```

### 4.2 Conectar a Netlify

1. Ve a https://netlify.com
2. Regístrate con GitHub
3. Haz clic en **Add new site** → **Import an existing project**
4. Conecta tu cuenta GitHub
5. Selecciona `finanzas-ieup`
6. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
7. Haz clic en **Deploy**

### 4.3 Agregar variables de entorno

1. En Netlify, ve a **Site settings** → **Build & deploy** → **Environment**
2. Haz clic en **Edit variables**
3. Agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_KEY`
4. Guarda

### 4.4 Redeploy

1. Ve a **Deployments**
2. Haz clic en el último deploy
3. **Trigger deploy** → **Deploy site**

¡Tu app estará en vivo en: `https://nombre-aleatorio.netlify.app`

---

## 📲 PASO 5: Instalar como PWA en Móvil

### Android

1. Abre la URL en Chrome
2. Toca el menú (⋮)
3. **Instalar aplicación**
4. ¡Listo! Aparecerá en tu pantalla de inicio

### iOS (iPhone/iPad)

1. Abre en Safari
2. Toca el botón **Compartir**
3. **Añadir a la pantalla de inicio**
4. ¡Listo! Aparecerá en tu pantalla de inicio

---

## 🔐 PASO 6: Crear Más Usuarios

### Cobradores
```sql
-- Crear usuario
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES ('cobrador@ieup.com', 'hashed_password', NOW());

-- Darle rol
INSERT INTO public.usuarios (email, rol) 
VALUES ('cobrador@ieup.com', 'cobrador');
```

**O desde la UI:**
1. Login como Admin
2. Ve a **Usuarios**
3. (Actualmente se crean desde Supabase Auth)

### Auditores
```sql
INSERT INTO public.usuarios (email, rol) 
VALUES ('auditor@ieup.com', 'auditor');
```

---

## 🛠️ Comandos Útiles

```bash
# Iniciar desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview

# Deploy a Netlify (requiere CLI)
netlify deploy --prod --dir=dist
```

---

## 📊 Estructura del Proyecto

```
finanzas-ieup/
├── src/
│   ├── components/          # Componentes reutilizables
│   ├── pages/               # Páginas principales
│   ├── services/            # Servicios (Supabase, offline)
│   ├── styles/              # Estilos CSS
│   ├── utils/               # Utilidades
│   ├── App.jsx              # Componente raíz
│   └── main.jsx             # Punto de entrada
├── public/                  # Archivos estáticos
│   ├── manifest.json        # Configuración PWA
│   └── sw.js                # Service worker
├── supabase-schema.sql      # Schema de base de datos
├── package.json             # Dependencias
├── vite.config.js           # Configuración Vite
├── tailwind.config.js       # Configuración Tailwind
└── README.md                # Este archivo
```

---

## 🔄 Sistema de Sincronización Offline

1. **Cuando estás sin internet:**
   - Los movimientos se guardan en localStorage
   - Ves un badge "Sin conexión" en la app

2. **Cuando tienes internet:**
   - Los cambios se sincronizan automáticamente
   - Ves "En línea" en el badge
   - Todo se guarda en Supabase

---

## 🐛 Troubleshooting

### Error: "VITE_SUPABASE_URL is undefined"
- Verifica que `.env.local` existe
- Revisa que las variables estén correctas
- Reinicia `npm run dev`

### Error: "Cannot connect to Supabase"
- Verifica que tu URL de Supabase es correcta
- Revisa que tu anon key es válida
- Comprueba tu conexión a internet

### Los cambios no se guardan offline
- Abre DevTools (F12)
- Ve a **Application** → **Local Storage**
- Verifica que `offlineQueue` existe
- Desconecta internet y prueba nuevamente

### No puedo iniciar sesión
- Verifica que el usuario existe en Supabase Auth
- Revisa que la contraseña es correcta
- Comprueba que RLS está habilitado

---

## 📚 Recursos Útiles

- **Supabase Docs:** https://supabase.com/docs
- **React Docs:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com
- **Recharts:** https://recharts.org

---

## 📞 Soporte

Para problemas:
1. Revisa la sección **Troubleshooting** arriba
2. Consulta los docs de Supabase
3. Verifica la consola (F12 → Console)

---

## 📄 Licencia

Uso libre para Iglesia Evangélica Unión Pentecostal

---

## ✨ Funcionalidades Futuras

- 📧 Envío de reportes por email
- 💾 Backup automático a Google Drive
- 📈 Predicciones con IA
- 🎨 Más temas de color
- 🌍 Soporte multiidioma

---

**Última actualización:** 2024
**Versión:** 1.0.0

¡Gracias por usar Finanzas IEUP! 🙏
