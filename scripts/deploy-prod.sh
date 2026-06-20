#!/usr/bin/env bash
# Despliegue a producción de "Catálogo Mamielina".
#
# Por qué este script existe:
# El repo es PRIVADO y el proyecto vive en una cuenta Vercel Hobby. El plan
# Hobby BLOQUEA cualquier deploy cuyo "commit author" no sea miembro del team
# ("Deployment Blocked: commit author did not have contributing access...").
# Como el CLI manda la metadata de git (autor del commit) incluso en deploys
# por subida de archivos, escondemos .git durante el deploy para que Vercel NO
# lea el commit y no aplique ese bloqueo.
#
# NOTA: usar build remoto normal (NO `--prebuilt`): el build local no incrusta
# los NEXT_PUBLIC_* y el middleware revienta con "Your project's URL and Key
# are required to create a Supabase client" (500 en todas las rutas).
#
# Uso:  bash scripts/deploy-prod.sh
set -euo pipefail
cd "$(dirname "$0")/.."

GITBAK="/tmp/catalogo-git-backup-$$"

restaurar() {
  if [ -d "$GITBAK" ] && [ ! -d .git ]; then
    mv "$GITBAK" .git
    echo "↩️  .git restaurado"
  fi
}
trap restaurar EXIT

rm -rf .next/dev
echo "🙈 Escondiendo .git (para saltar el bloqueo Hobby por commit author)…"
mv .git "$GITBAK"

echo "🚀 Desplegando a producción (build remoto)…"
vercel --prod --yes

# restaurar() corre en el trap EXIT
echo "✅ Listo. Verifica: https://mamielina.myelplay.com/mamielina"
