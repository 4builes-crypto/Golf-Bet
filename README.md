# Golf Bet - Guía de Inicio Rápido

¡Bienvenido a Golf Bet! He configurado la base para tu aplicación.

## Contenido del Proyecto
1.  **`ARCHITECTURE.md`**: Detalle técnico de la estructura, componentes y flujo.
2.  **`schema.sql`**: Código SQL para crear las tablas en Supabase.
3.  **Prototipo de UI**:
    *   `index.html`: Estructura de la aplicación.
    *   `style.css`: Sistema de diseño premium (Modo oscuro + Verde Golf).
    *   `app.js`: Lógica base y algoritmo de handicap.

## Pasos para continuar
1.  **Supabase**:
    *   Crea un nuevo proyecto en [Supabase](https://supabase.com).
    *   Copia el contenido de `schema.sql` y ejecútalo en el "SQL Editor".
2.  **Desarrollo Local**:
    *   Para ver el prototipo actual, simplemente abre `index.html` en tu navegador.
    *   Para iniciar el proyecto con Next.js, ejecuta en tu terminal local:
        ```bash
        npx create-next-app@latest .
        ```
3.  **Integración de Datos**:
    *   Configura las variables de entorno (`.env.local`) con tu `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

## Funcionalidades Premium Incluidas
*   **Algoritmo de Handicap**: El archivo `app.js` contiene la lógica para calcular ventajas hoyo a hoyo basándose en el índice de dificultad.
*   **Conversión de Moneda**: Soporte nativo para COP y USD.
*   **Diseño Móvil**: Optimizado para uso en campo con botones grandes y alto contraste.
