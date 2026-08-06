# Xcalidraw by Kurk para macOS

La aplicación de escritorio usa Electron como contenedor nativo seguro y conserva el mismo almacenamiento IndexedDB local-first. Cada perfil queda aislado dentro del directorio de datos de la aplicación.

## Empaquetar

Desde la raíz:

```bash
npm install --prefix desktop
npm run --prefix desktop dist
```

El comando `dist` exige un árbol de trabajo ya guardado en Git, compila la interfaz, incrusta ese commit y luego genera el DMG y el ZIP de actualización. Esto evita que una aplicación se identifique como una revisión distinta de su contenido real. El empaquetador usa temporalmente una ruta segura de macOS —también funciona si el directorio del repositorio contiene espacios o `|`— y deja los artefactos versionados en `desktop/dist`. Es una compilación arm64 para Apple Silicon. Los Releases públicos deben firmarse y notarizarse con Apple Developer ID.

## Versiones y actualizaciones

La aplicación consulta GitHub al abrirse y también desde **Comprobar actualizaciones**. Si existe un Release firmado más nuevo, puede descargarlo en segundo plano y mostrar **Reiniciar y actualizar**: Electron reemplaza la aplicación y vuelve a abrirla sin pedir otro DMG. Los perfiles y proyectos permanecen en el directorio histórico de Application Support.

El workflow **Release Xcalidraw by Kurk** compila cada versión, genera DMG + ZIP + metadatos diferenciales, firma y notariza el binario, y publica un Release con la etiqueta `xcalidraw-desktop-v<versión>`. Una versión no puede publicarse dos veces.

Para que macOS acepte la actualización automática, el repositorio debe tener estos secretos de GitHub Actions: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` y `APPLE_TEAM_ID`. La primera instalación firmada se realiza con el DMG; a partir de esa versión, las siguientes se aplican dentro de la app.

## Recursos públicos

La isla flotante incluye **Iconos y fotos**. Iconify funciona sin clave y reúne colecciones abiertas. La búsqueda traduce términos frecuentes entre castellano e inglés. Para Unsplash, pega una **Access Key** gratuita en el panel de fotos (nunca la Secret Key); queda guardada solo en esa Mac y los resultados conservan la atribución requerida.

Para mover el contenido a otra Mac, usa **Exportar todo** en el dashboard, instala la aplicación en la otra computadora y selecciona **Restaurar backup**.

## Alineación de precisión

Los lienzos nuevos y los existentes migrados una sola vez activan el ajuste magnético a objetos. Al mover, crear o redimensionar elementos, el editor alinea bordes y centros, detecta espacios equivalentes y dibuja guías magenta de alto contraste con medidas. La intensidad visual se mantiene estable con cualquier zoom. Puede desactivarse en **Preferencias → Ajustar a objetos** o temporalmente durante un arrastre manteniendo `⌘` en macOS. `⌘D` duplica exactamente en el mismo lugar; Option-arrastrar conserva al original como referencia de alineación.

## Organización y referencias

Las vistas admiten nombre, descripción, orden manual, carpetas y subcarpetas. Sus altas, movimientos, renombrados y confirmaciones usan modales propios en lugar de alertas del sistema; la biblioteca aplica el mismo criterio. La librería exige nombrar cada asset, incorpora búsqueda y conserva rutas de carpetas exportables. Cada lienzo sin cifrar genera su propia miniatura ajustada al contenido completo. Desde el icono universal de biblioteca en la isla flotante se puede insertar en el canvas una tarjeta nativa que referencia otro lienzo, proyecto o una vista guardada: el modal recorta la miniatura al sector de esa vista y, al abrirla, restaura exactamente su encuadre y zoom. Al seleccionar una de estas tarjetas y pulsar la barra espaciadora se abre su vista previa tipo Quick Look para recorrer el proyecto o navegar al lienzo o vista exactos.

Los seis perfiles de color de cada lienzo guardan fondo, color de elementos y contraste. Los trazos libres pueden terminar como elementos individuales o como un único sketch agrupado, y el candado de una selección bloquea el elemento de forma efectiva.

## IA multimodal con OpenRouter

En **IA · OpenRouter** se introduce una API key nueva dentro de la aplicación. La clave queda cifrada por perfil, nunca vuelve a mostrarse y solo se puede reemplazar o borrar validando la contraseña administradora. El modelo se puede cambiar sin volver a pegar la clave. El catálogo sugiere opciones económicas, omnimodales y de máxima fidelidad, indicando si admiten imagen, PDF, audio o video y mostrando sus precios.

La aplicación ofrece texto a diagrama, Mermaid editable, reconstrucción de screenshots/fotos y análisis de imagen, PDF, audio o video. Los perfiles **Ejecutivo**, **Rápido** y **Profundo** cambian el nivel de síntesis; cada resultado incluye preguntas sugeridas para afinar una segunda pasada. El consumo informado por OpenRouter se ve por día —solicitudes, tokens y coste USD— dentro del perfil.
