# Scripts Templates

Templates de los scripts de operación. Sin tokens ni secretos — safe para versionar.

## Setup

1. Copia cada `.template` a `scripts/` (sin la extensión `.template`)
2. Reemplaza `<TU_TOKEN_DE_BOTFATHER>` con tu token real de Telegram
3. `chmod +x scripts/*.sh`

```bash
cd scripts
for f in templates/*.sh.template; do
  cp "$f" "$(basename "$f" .template)"
done
chmod +x *.sh
# Editar start-fleet.sh para poner tu TELEGRAM_BOT_TOKEN
```

## Archivos

| Template | Destino | Descripción |
|----------|---------|-------------|
| `start-fleet.sh.template` | `scripts/start-fleet.sh` | Arranca fleet directo (alias: `mac`) |
| `heartbeat.sh.template` | `scripts/heartbeat.sh` | Heartbeat cada 15 min |
| `install-heartbeat.sh.template` | `scripts/install-heartbeat.sh` | Instala launchd job (alias: `mahi`) |
| `uninstall-heartbeat.sh.template` | `scripts/uninstall-heartbeat.sh` | Desinstala launchd job (alias: `maho`) |
| `heartbeat-launchd.plist.template` | `~/Library/LaunchAgents/com.example.money-agents-heartbeat.plist` | launchd plist |

## Aliases (agregar a ~/.zshrc)

```bash
alias mac='/path/to/money-agents/scripts/start-fleet.sh'
alias mahi='/path/to/money-agents/scripts/install-heartbeat.sh'
alias maho='/path/to/money-agents/scripts/uninstall-heartbeat.sh'
```
