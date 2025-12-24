Scan codebase for unmapped components.

Usage: `/wogi-map-scan [directory]`

Default directory: `src/components`

Steps:
1. Find all component files (.tsx, .jsx, .vue)
2. Compare with entries in app-map.md
3. Report unmapped components

Output:
```
🔍 Scanning: src/components

Found 15 component files
Mapped in app-map: 12

Unmapped (3):
  • src/components/ui/Tooltip.tsx
  • src/components/forms/DatePicker.tsx
  • src/components/layout/Sidebar.tsx

Add these with /wogi-map-add or:
  /wogi-map-add Tooltip components/ui/Tooltip
  /wogi-map-add DatePicker components/forms/DatePicker
  /wogi-map-add Sidebar components/layout/Sidebar
```

If all components are mapped:
```
🔍 Scanning: src/components

Found 12 component files
Mapped in app-map: 12

✓ All components are mapped!
```
