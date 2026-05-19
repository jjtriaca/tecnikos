#!/usr/bin/env bash
# Barreira: bloqueia Edit/Write quando version.json local != prod /api/health
# Acionado via PreToolUse hook no .claude/settings.local.json
#
# Regras:
#   - Libera tools de leitura (este hook so e chamado em Edit/Write/MultiEdit)
#   - Libera arquivos dentro de .claude/worktrees/* (sao branches isoladas do Claude)
#   - Libera se nao for um repo git ou nao tiver version.json (nada a comparar)
#   - Cacheia o resultado por 30min em /tmp pra nao curl a cada edit
#   - Timeout 3s no curl. Se a rede falhar: fail-open (libera) pra nao travar trabalho offline
#
# Saidas:
#   exit 0  -> permite
#   exit 2  -> bloqueia (Claude recebe a mensagem em stderr e tem que abortar)

set -u

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$REPO_ROOT" ]]; then exit 0; fi  # nao e git

VERSION_FILE="$REPO_ROOT/version.json"
if [[ ! -f "$VERSION_FILE" ]]; then exit 0; fi  # nao tem version.json

# le o path do arquivo que esta sendo editado (vem via stdin JSON do harness)
INPUT="$(cat || true)"
TARGET_PATH="$(printf '%s' "$INPUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path","") or d.get("tool_input",{}).get("notebook_path",""))' 2>/dev/null || true)"

# se o arquivo esta dentro de .claude/worktrees, libera (branches isoladas)
if [[ "$TARGET_PATH" == *"/.claude/worktrees/"* ]] || [[ "$TARGET_PATH" == *"\\.claude\\worktrees\\"* ]]; then
  exit 0
fi

# cache: revalida a cada 30min
CACHE_FILE="/tmp/.tecnikos_version_check"
CACHE_TTL=1800
NOW=$(date +%s)
if [[ -f "$CACHE_FILE" ]]; then
  CACHED_TIME=$(stat -c %Y "$CACHE_FILE" 2>/dev/null || stat -f %m "$CACHE_FILE" 2>/dev/null || echo 0)
  AGE=$((NOW - CACHED_TIME))
  if [[ $AGE -lt $CACHE_TTL ]]; then
    CACHED_VERDICT=$(cat "$CACHE_FILE")
    if [[ "$CACHED_VERDICT" == "OK" ]]; then exit 0; fi
    # se cache=BLOQUEIO, mostra a mesma mensagem
    echo "$CACHED_VERDICT" >&2
    exit 2
  fi
fi

LOCAL_VERSION=$(python3 -c "import json; print(json.load(open(r'$VERSION_FILE'))['version'])" 2>/dev/null)
PROD_HEALTH=$(curl -fsS --max-time 3 https://sls.tecnikos.com.br/api/health 2>/dev/null)

# rede caiu ou prod fora do ar -> fail-open
if [[ -z "$PROD_HEALTH" ]]; then
  echo "OK" > "$CACHE_FILE"
  exit 0
fi

PROD_VERSION=$(printf '%s' "$PROD_HEALTH" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("version",""))' 2>/dev/null)

if [[ -z "$PROD_VERSION" ]] || [[ -z "$LOCAL_VERSION" ]]; then
  echo "OK" > "$CACHE_FILE"
  exit 0
fi

if [[ "$LOCAL_VERSION" == "$PROD_VERSION" ]]; then
  echo "OK" > "$CACHE_FILE"
  exit 0
fi

# BLOQUEIO
MSG=$(cat <<EOF

🛑 BARREIRA DE VERSAO DISPARADA

  Local:  v$LOCAL_VERSION  (pasta $REPO_ROOT)
  Prod:   v$PROD_VERSION  (sls.tecnikos.com.br)

A pasta local esta desalinhada com producao. Editar agora vai gerar codigo
em cima de uma base velha — risco de regredir o sistema ao commitar.

ACOES OBRIGATORIAS antes de prosseguir:
  1. Verificar git status (cuidar de mudancas nao-comitadas)
  2. git fetch origin && git pull origin main
  3. Confirmar version.json bate com prod

Esta barreira so esta ativa pra Edit/Write na pasta principal. Worktrees em
.claude/worktrees/ continuam liberados (branches isoladas).

Pra revalidar manualmente: rm /tmp/.tecnikos_version_check
EOF
)
printf '%s\n' "$MSG" > "$CACHE_FILE"
printf '%s\n' "$MSG" >&2
exit 2
