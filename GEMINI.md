# Pravidla pracovního postupu (Workspace Rules)

V každé konverzaci a při každé práci v tomto repozitáři dodržuj následující postup:

1. **Synchronizace před úpravou:** Před každou úpravou kódu vždy stáhni nejnovější změny z GitHubu příkazem `git pull origin main`.
2. **Práce přímo v `main`:** Veškeré úpravy prováděj přímo ve větvi `main`. Nevytvářej žádné vedlejší větve.
3. **Ověření buildu:** Po dokončení úprav vždy ověř funkčnost a typy spuštěním `npm run lint` nebo `npm run build`.
4. **Commit a push:** Po úspěšném ověření vytvoř výstižný commit a změny rovnou odešli na GitHub příkazem `git push origin main`.
