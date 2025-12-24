Create a new feature with proposal and task structure. Provide name: `/wogi-feature user-auth`

Steps:
1. Create directory `.workflow/changes/[feature-name]/`
2. Create `proposal.md` from template
3. Create `tasks.json` with empty task array
4. Ask user for feature details to populate

Output:
```
📁 Created feature: user-auth

Directory: .workflow/changes/user-auth/
  • proposal.md (template)
  • tasks.json (empty)

Let's define this feature:

1. What problem does this solve?
2. Who is the target user?
3. What are the main capabilities?
4. Any technical constraints?

[After user responds, populate proposal.md and create initial stories]
```

After gathering info, use `/wogi-story` to create individual stories for the feature.
