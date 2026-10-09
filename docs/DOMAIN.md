# Domain and hosting notes

The site is published by GitHub Pages (`.github/workflows/pages.yml`) at **https://leanstudio.app/**.

## DNS (Cloudflare), all records "DNS only" (grey cloud)

| Type | Name | Value |
|---|---|---|
| A | `@` | 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 (four records) |
| AAAA (optional) | `@` | 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153 |
| CNAME | `www` | `<github user>.github.io` |
| TXT | `@` | `v=spf1 -all` (this domain sends no email) |
| TXT | `_dmarc` | `v=DMARC1; p=reject;` |

GitHub: repo Settings > Pages > Custom domain `leanstudio.app`, Enforce HTTPS ticked.

## Cloudflare settings worth having
- SSL/TLS > Edge Certificates: **Always Use HTTPS** on. If the proxy (orange cloud) is ever turned on, set SSL/TLS
  encryption mode to **Full (strict)** first. Leaving it "DNS only" is simplest.
- DNS > Settings: **DNSSEC** on (the domain is registered at Cloudflare, so the DS record is added for you).
- Registrar: auto-renew on, transfer lock on. Two-step sign-in on the Cloudflare and GitHub accounts: whoever controls
  either controls the site.
- If email on the domain is wanted later: Email Routing (adds MX records); the SPF record then needs
  `include:_spf.mx.cloudflare.net`.

## Browser data belongs to the address
Projects, accounts and settings are stored per web address. Moving the site to a new address starts empty:
save each project to a file first (File > Save project) and open the files at the new address.

## Offline and updates
`sw.js` (a service worker) keeps the app's files so it opens with no network, and the site can be installed
(Add to Home screen). On deploy `__BUILD__` in `sw.js` becomes the commit id, and the css/script links in
`index.html` are stamped the same way, so each release has its own cache and a browser never mixes old and new
files. After a release, people see "A new version is ready. Reload to use it." once the new files are saved.
It needs http(s): opening `index.html` from a file works but does not cache. `tests/offline.cjs` checks it.
