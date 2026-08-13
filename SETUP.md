# PLM Console — Initial Shell Setup

Copy the contents of this folder into your new root:

```
G:\Bedrock\PLMC\
```

## Expected layout after copy

```
G:\Bedrock\PLMC\
  index.html
  package.json
  postcss.config.js
  tailwind.config.js
  tsconfig.json
  vite.config.ts
  public\
    images\
      AWS LOGO v2b - Presentations small.png   ← copy from PID
  src\
    App.tsx
    main.tsx
    index.css
    components\
      layout\
        Sidebar.tsx
    pages\
      Dashboard.tsx
      SystemRegistry.tsx
    data\
      awsSmxSeedData.ts
```

## First run

```bash
cd G:\Bedrock\PLMC
npm install
npm run dev
```

## Logo

Copy the same AWS logo file you use in PID into:

```
public/images/AWS LOGO v2b - Presentations small.png
```

If the logo is missing the sidebar still renders; the image simply hides.

## Amplify

This shell is ready for Amplify Gen 2 exactly like PID. After you initialize the backend:

```bash
npx ampx sandbox
```

`amplify_outputs.json` will appear and auth will activate. Until then the Authenticator may show a configuration warning — that is expected.

## What is live

- Frame + zinc/blue shell matching PID
- Sidebar with logo, “PLM Console” title, nav
- Dashboard home
- System Registry (full AWS SMX tree + ComponentCard) so you can start inspecting and later adding parts

## Next

- Planning & Cost fields on entities
- Editable “add part” flows
- Suppliers / Vertical Integrators detail
- Amplify data models
