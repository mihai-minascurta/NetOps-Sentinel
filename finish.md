# NetOps Sentinel — TODO

## 1. Finalizat
- [x] Infrastructură OCI — R1 + R2
- [x] Monitoring + Backend + AI Diagnosis
- [x] Frontend + Incident Simulator
- [x] Caddy + HTTPS + Let's Encrypt
- [ ] Confirmare persistență firewall

## 2. Security — urgent
- [ ] Rotire parolă Gmail App Password pe R2
- [ ] Restart Alertmanager și test email
- [ ] Revocare parolă veche
- [ ] Excludere secrete din Git și verificare istoric
- [ ] Repository GitHub privat

## 3. Live Mode
- [ ] Recuperare `topology_status.py` din commitul `d31a5c7`
- [ ] Înregistrare rută în `main.py`
- [ ] Configurare variabile `.env` pentru Prometheus și Alertmanager
- [ ] Expunere FastAPI pe IP-ul privat `10.60.2.95:8000`
- [ ] OCI + firewall: TCP 8000 permis exclusiv din R1 (`10.60.1.245/32`)
- [ ] Caddy Reverse Proxy: GET `/api/topology/status` → R2
- [ ] Same-origin API, fără expunerea webhook-ului sau a endpoint-urilor administrative
- [ ] Activare polling în build-ul de producție
- [ ] Testare statusuri reale R1/R2 în UI
- [ ] SSE pentru evenimente și impulsuri în timp real (ulterior)

## 4. Cleanup
- [ ] Eliminare asset-uri nefolosite și `.venv` din Git
- [ ] Actualizare README și `.gitignore`
- [ ] Rezolvare `test_prometheus_collector.py`
- [ ] Verificare reînnoire automată TLS
- [ ] Testare persistență și recuperare după reboot
- [ ] Domeniu personalizat (opțional)
