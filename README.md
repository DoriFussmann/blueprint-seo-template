# Blueprint SEO template

Reusable Astro 5 site + local Express CMS. Clone per project, then run Site Activation.

```bash
npm install
npm run cms      # http://localhost:3737
npm run dev      # public site
npm run build
```

Identity lives in `site/src/config/site.ts` only. Copy `cms/.env.example` to `cms/.env` for DataForSEO and PageSpeed. Do not deploy this template as-is.
