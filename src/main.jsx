import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

That's the entire file. Nothing else.

---

**Step 4: Create `src/App.jsx`**

Download the `unroute.jsx` file from this chat (the file I just shared above). Save it as:
```
C:\Users\Mahdi.Ahmed\unroute\src\App.jsx
```

The file name must be `App.jsx` — not `unroute.jsx`. The contents are from the file I shared, but the filename needs to match what `main.jsx` imports.

---

**Step 5: Test locally**
```
cd C:\Users\Mahdi.Ahmed\unroute
npm run dev
```

Your terminal will show something like:
```
  VITE v5.x.x  ready in 300ms

  ➜  Local:   http://localhost:5173/
```

Open `http://localhost:5173` in Chrome. You should see the Unroute app with the compass icon, the "Flavour of Lost" selector, and the location inputs.

**Test these things:**

1. Type "SE1" in the destination box — you should see autocomplete suggestions appear with UK postcodes
2. Pick one — a "✓ Resolved" badge should appear beneath the input showing the full address and coordinates
3. Type "King's Cross" in the starting from box (switch to manual first) — pick from dropdown, check for ✓ Resolved
4. Hit "Get Beautifully Lost" — it should show real places from OpenStreetMap (or Pioneer Mode if the sandbox blocks the request)

---

**Step 6: Create a GitHub repo**

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `unroute`
3. Leave it set to Public
4. Do NOT tick "Add a README" — leave it completely empty
5. Click "Create repository"

---

**Step 7: Push your code to GitHub**

Back in your terminal:
```
cd C:\Users\Mahdi.Ahmed\unroute
git init
git add .
git commit -m "Unroute V3 - initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/unroute.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

If it asks for authentication, use your GitHub personal access token as the password (not your GitHub password). If you don't have a token, go to GitHub → Settings → Developer settings → Personal access tokens → Generate new token.

---

**Step 8: Deploy to Vercel**

1. Go to [vercel.com/new](https://vercel.com/new)
2. You should see your GitHub repos — click "Import" next to `unroute`
3. Framework Preset will auto-detect as "Vite" — leave it
4. Leave all other settings as default
5. Click "Deploy"

It takes about 30–60 seconds. When it's done, Vercel gives you a URL like:
```
https://unroute.vercel.app