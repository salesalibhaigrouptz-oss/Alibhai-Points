# Alibhai Points legal pages

This is a static, framework-free site containing the privacy policy and
account-deletion instructions in English and Swahili.

## Folder structure

```text
apps/legal-pages/
├── assets/
│   ├── language.js
│   └── site.css
├── delete-account/
│   └── index.html
├── index.html
├── privacy/
│   └── index.html
├── vercel.json
└── README.md
```

The landing page is served at `/`; the legal pages are served at `/privacy` and
`/delete-account`. Each page's language selector switches the content without
leaving the page.

## Before publishing

Replace every square-bracket placeholder in both pages with approved business
information and retention/processing periods. In particular, confirm the
legal name, address, support email and phone/WhatsApp contact, effective date,
general data-retention period, accounting-record retention period, and
deletion-request processing time. Review the final wording with the business
and local legal adviser before publishing.

The mobile app's optional links can be set to the deployed site's
`https://<your-domain>/privacy` and
`https://<your-domain>/delete-account` URLs.

## Deploy as a separate Vercel project

1. Push this repository to the Git provider connected to Vercel.
2. In Vercel, choose **Add New → Project** and import this repository.
3. Set **Root Directory** to `apps/legal-pages`.
4. Choose **Other** as the Framework Preset. Leave Build Command, Install
   Command and Output Directory blank; there is no build step or dependency
   installation.
5. Deploy. Vercel serves the static HTML and assets; `vercel.json` maps the
   clean `/privacy` and `/delete-account` paths to their respective
   `index.html` files.
6. Test both deployed routes and switch each page to Kiswahili and back.
7. Optionally add a custom domain in the Vercel project settings, then set the
   two optional `EXPO_PUBLIC_` URLs in the EAS `development`, `preview` and
   `production` environments.

Alternatively, from the repository root, use the Vercel CLI:

```sh
vercel
```

When prompted, choose to create a new project, set the project directory to
`apps/legal-pages`, select **Other**, and leave build/output settings blank.
For a production deployment, link that project and run:

```sh
vercel --prod
```
