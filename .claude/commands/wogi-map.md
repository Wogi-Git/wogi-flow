Display the component registry (app-map).

Read `.workflow/state/app-map.md` and show:

1. **Screens** - All screens with their routes
2. **Modals** - All modals with their triggers  
3. **Components** - All components with variants and paths

Output format:
```
🗺️ App Map

Screens (5):
  • Login → /login
  • Dashboard → /dashboard
  • Profile → /profile
  • Settings → /settings
  • NotFound → /404

Modals (3):
  • ConfirmDelete → Delete button click
  • UserSettings → Settings icon click
  • ImagePicker → Avatar click

Components (12):
  • Button (primary, secondary, ghost) → components/ui/Button
  • Input (text, password, email) → components/ui/Input
  • Card (default, elevated) → components/ui/Card
  • Avatar (small, medium, large) → components/ui/Avatar
  ...

Use /wogi-map-add to add new components.
```
