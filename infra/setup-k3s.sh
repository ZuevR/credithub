#!/usr/bin/env bash
#
# Подготовка Linux-машины под инфраструктуру CreditHub: k3s + Helm + Traefik.
#
# Скрипт идемпотентен: повторный запуск ничего не сломает - уже установленные
# компоненты пропускаются. Он фиксирует ровно то, что сделано руками, чтобы
# состояние машины не держалось на переписке.
#
# Запуск (на целевой машине):
#   bash infra/setup-k3s.sh
#
# Предполагается, что пользователь может выполнять sudo без пароля. Если нет -
# настройте заранее: echo "$USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/$USER
#
set -euo pipefail

K3S_INSTALL_URL="https://get.k3s.io"
# Мажор Helm 3, а не 4: чарты пишем сами, и внезапный мажор в фундаменте
# инфраструктуры - лишний риск. Обновление до 4.x должно быть осознанным шагом.
HELM_MAJOR="v3"
TRAEFIK_CHART_VERSION="${TRAEFIK_CHART_VERSION:-}"

log() { printf '\n=== %s ===\n' "$1"; }

# --- k3s -------------------------------------------------------------------
# Traefik отключаем намеренно: ставим его отдельно через Helm, чтобы управлять
# версией и настройками, а не получать то, что выбрал k3s.
if command -v k3s >/dev/null 2>&1; then
  log "k3s уже установлен: $(k3s --version | head -1)"
else
  log "устанавливаю k3s (без встроенного Traefik)"
  curl -sfL "$K3S_INSTALL_URL" | INSTALL_K3S_EXEC="--disable traefik" sh -
fi

log "жду готовности ноды"
for _ in $(seq 1 60); do
  state=$(sudo -n k3s kubectl get nodes --no-headers 2>/dev/null | awk '{print $2}' || true)
  [ "$state" = "Ready" ] && break
  sleep 2
done
sudo -n k3s kubectl get nodes

# --- kubectl ---------------------------------------------------------------
# В k3s `kubectl` - симлинк на сам k3s, и он читает /etc/rancher/k3s/k3s.yaml
# мимо ~/.kube/config. Ставим настоящий клиент, иначе каждая команда требует sudo.
if [ -x /usr/local/bin/kubectl ] && /usr/local/bin/kubectl version --client >/dev/null 2>&1; then
  log "kubectl уже установлен: $(kubectl version --client 2>/dev/null | head -1)"
else
  log "устанавливаю kubectl"
  kver=$(curl -fsSL https://dl.k8s.io/release/stable.txt)
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/kubectl" "https://dl.k8s.io/release/${kver}/bin/linux/amd64/kubectl"
  curl -fsSL -o "$tmp/kubectl.sha256" "https://dl.k8s.io/release/${kver}/bin/linux/amd64/kubectl.sha256"
  # Проверка суммы обязательна: скачиваем бинарник по сети и кладём в /usr/local/bin.
  (cd "$tmp" && echo "$(cat kubectl.sha256)  kubectl" | sha256sum -c -)
  sudo -n install -o root -g root -m 0755 "$tmp/kubectl" /usr/local/bin/kubectl
  rm -rf "$tmp"
fi

# --- kubeconfig для пользователя ------------------------------------------
if [ -f "$HOME/.kube/config" ]; then
  log "~/.kube/config уже есть"
else
  log "настраиваю ~/.kube/config"
  mkdir -p "$HOME/.kube"
  sudo -n cp /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config"
  sudo -n chown "$(id -u):$(id -g)" "$HOME/.kube/config"
  # В k3s конфиг указывает на 127.0.0.1 - снаружи это не работает.
  host_ip=$(hostname -I | awk '{print $1}')
  sed -i "s|https://127.0.0.1:6443|https://${host_ip}:6443|" "$HOME/.kube/config"
  chmod 600 "$HOME/.kube/config"
fi
kubectl get nodes

# --- Helm ------------------------------------------------------------------
if command -v helm >/dev/null 2>&1; then
  log "Helm уже установлен: $(helm version --short)"
else
  log "устанавливаю Helm ${HELM_MAJOR}.x"
  # Через релизы GitHub, а не скриптом get-helm-3: тот тянет последний мажор
  # (сейчас 4.x), а нам нужен предсказуемый 3.x.
  tag=$(curl -fsSL "https://api.github.com/repos/helm/helm/releases?per_page=100" \
    | grep '"tag_name"' | cut -d'"' -f4 | grep "^${HELM_MAJOR}\." | head -1)
  echo "версия: $tag"
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/helm.tgz" "https://get.helm.sh/helm-${tag}-linux-amd64.tar.gz"
  curl -fsSL -o "$tmp/helm.sha256" "https://get.helm.sh/helm-${tag}-linux-amd64.tar.gz.sha256sum"
  (cd "$tmp" && sha256sum -c helm.sha256)
  tar -xzf "$tmp/helm.tgz" -C "$tmp"
  sudo -n install -o root -g root -m 0755 "$tmp/linux-amd64/helm" /usr/local/bin/helm
  rm -rf "$tmp"
fi

# --- Traefik ---------------------------------------------------------------
log "ставлю Traefik"
helm repo add traefik https://traefik.github.io/charts >/dev/null 2>&1 || true
helm repo update >/dev/null

# shellcheck disable=SC2086
helm upgrade --install traefik traefik/traefik \
  --namespace traefik --create-namespace \
  ${TRAEFIK_CHART_VERSION:+--version "$TRAEFIK_CHART_VERSION"} \
  --set deployment.replicas=1 \
  --set resources.requests.cpu=100m \
  --set resources.requests.memory=128Mi \
  --set resources.limits.memory=512Mi \
  --wait --timeout 5m

log "готово"
kubectl get pods -n traefik
kubectl get svc -n traefik
echo
echo "Проверка входа (ожидается 404 от Traefik - это нормально, маршрутов пока нет):"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' http://\$(hostname -I | awk '{print \$1}')/"
