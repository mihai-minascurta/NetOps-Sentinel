# De făcut la final, în ordinea recomandată

## 1. Rotirea parolei Gmail (urgentă înainte de orice push)

- [ ] Creezi o parolă de aplicație nouă la `myaccount.google.com/apppasswords`
- [ ] O scrii pe R2 în `monitoring/secrets/gmail_app_password`, fără să schimbi permisiunile fișierului
- [ ] `docker compose restart alertmanager`, apoi trimiți o alertă de test și verifici că a ajuns emailul
- [ ] Revoci parola veche abia după email
- [ ] Pe laptop: `monitoring/secrets/` în `.gitignore`, apoi `git rm --cached` pe fișier și commit
- [ ] Verifici `git remote -v`: dacă repo-ul ajunge pe GitHub, doar privat

## 2. Varianta live (R1 ↔ R2)

- [ ] Recuperezi `topology_status.py` din reflog (commitul `d31a5c7`) și montezi ruta în `main.py` pe R2
- [ ] În `.env` pe R2: `PROMETHEUS_URL`, `ALERTMANAGER_URL` și `TOPOLOGY_CORS_ORIGIN` sau proxy pe aceeași origine
- [ ] R2 publică API-ul pe IP-ul privat `10.60.2.95:8000`, nu pe `127.0.0.1`
- [ ] Regulă OCI de ingress: TCP 8000, sursa doar IP-ul privat al lui R1 (`10.60.1.245/32`)
- [ ] Nginx pe R1 face proxy către R2 doar pe `/api/topology/status`, fără webhook și fără `/incidents/*`
- [ ] Build de producție cu polling activ (acum e doar în dev)
- [ ] Test: headerul trece din „Live mode coming soon" în „Live", iar R1/R2 apar UP sau DOWN

## 3. Curățenie și finisaje (opțional, fără grabă)

- [ ] Auditul de curățenie: grupurile A-D (asset-uri nefolosite, `.venv` scos din index, README-uri și `.gitignore`), pe o ramură separată
- [ ] Decizia pentru `test_prometheus_collector.py`: ori codul citește `PROMETHEUS_URL` din mediu, ori ștergi testul. Până atunci îl lași necomis, iar `incident_manager/` nu-l copiezi de pe laptop peste R2
- [ ] HTTPS cu domeniu și Certbot, dacă vrei pagina în portofoliu
