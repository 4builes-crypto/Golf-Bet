# Golf Bet - Arquitectura y Plan de Implementación

## 1. Visión General
Golf Bet es una aplicación móvil-primero diseñada para simplificar la gestión de puntajes y apuestas durante una ronda de golf. El enfoque principal es la rapidez de entrada de datos y la transparencia en los cálculos financieros al finalizar.

## 2. Pila Tecnológica (Tech Stack)
- **Frontend**: Next.js (React) con TypeScript.
- **Estilos**: Vanilla CSS con variables para el sistema de diseño (tokens).
- **Backend/Base de Datos**: Supabase (PostgreSQL + Auth + Realtime).
- **Despliegue**: Vercel.
- **Estado Global**: React Context o Zustand para sincronización en tiempo real.

## 3. Modelo de Datos (PostgreSQL)

### Tabla: `profiles`
Extiende la tabla de `auth.users` de Supabase.
- `id`: uuid (PK)
- `email`: text
- `display_name`: text
- `handicap`: float (default: 0)
- `avatar_url`: text
- `total_xp`: int (default: 0)
- `level`: int (default: 1)

### Tabla: `rounds`
- `id`: uuid (PK)
- `course_name`: text
- `date`: timestamp
- `status`: enum ('active', 'completed')
- `created_by`: uuid (FK profiles)

### Tabla: `round_players`
Relación muchos a muchos entre rondas y jugadores.
- `round_id`: uuid (FK rounds)
- `player_id`: uuid (FK profiles)
- `handicap_at_round`: float (El handicap que tenía al iniciar para historial).

### Tabla: `scores`
- `id`: uuid (PK)
- `round_id`: uuid (FK rounds)
- `player_id`: uuid (FK profiles)
- `hole_number`: int (1-18)
- `strokes`: int
- `putts`: int

### Tabla: `bets`
- `id`: uuid (PK)
- `round_id`: uuid (FK rounds)
- `type`: text (e.g., 'Skins', 'Match Play', 'Nassau')
- `amount`: numeric
- `currency`: enum ('COP', 'USD')
- `config`: jsonb (Permite flexibilidad para diferentes reglas de apuestas).

## 4. Flujo de Usuario Principal
1. **Inicio**: El usuario crea una ronda y agrega amigos (vía email o búsqueda).
2. **Configuración de Apuestas**: Se seleccionan las apuestas activas (Individules o Grupales).
3. **Durante la Ronda**:
   - Interfaz de "Hoyo Actual" con entrada rápida (+/-) para golpes y putts.
   - Tabla dinámica que aplica ventajas por handicap automáticamente.
4. **Finalización**:
   - Resumen de resultados.
   - Algoritmo de resolución de deudas (quién paga a quién).
   - Conversión de divisas en tiempo real (COP <-> USD).

## 5. Estrategia de Diseño (UX)
- **Modo Oscuro Obligatorio**: Fondo negro (#000000) para ahorrar batería en campo y mejorar contraste bajo el sol.
- **Acento Verde**: Usar #347C2C para acciones principales y estados positivos.
- **Glassmorphism**: Paneles con `backdrop-filter: blur(10px)` para una sensación premium.
- **Input Minimalista**: Evitar teclados numéricos si es posible, usar botones grandes (+ / -).
