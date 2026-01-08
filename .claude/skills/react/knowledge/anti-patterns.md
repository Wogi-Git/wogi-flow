# React Anti-Patterns

Patterns to avoid in React projects.
These cause bugs, performance issues, or maintenance problems.

---

## Component Anti-Patterns

### Anti-Pattern: Mutating State Directly

**Bad**:
```tsx
// DON'T: Mutating state array directly
const [items, setItems] = useState([]);
items.push(newItem); // Mutates state directly!
setItems(items);
```

**Good**:
```tsx
// DO: Create new array
setItems([...items, newItem]);
// or
setItems(prev => [...prev, newItem]);
```

**Why it's bad**: React won't detect the change, component won't re-render

---

### Anti-Pattern: Unnecessary State

**Bad**:
```tsx
function Greeting({ firstName, lastName }) {
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    setFullName(`${firstName} ${lastName}`);
  }, [firstName, lastName]);

  return <h1>{fullName}</h1>;
}
```

**Good**:
```tsx
function Greeting({ firstName, lastName }) {
  const fullName = `${firstName} ${lastName}`;
  return <h1>{fullName}</h1>;
}
```

**Why it's bad**: Derived state causes unnecessary re-renders, useEffect makes it async

---

## Hook Anti-Patterns

### Anti-Pattern: Missing Dependencies

**Bad**:
```tsx
useEffect(() => {
  fetchData(userId);
}, []); // Missing userId dependency!
```

**Good**:
```tsx
useEffect(() => {
  fetchData(userId);
}, [userId]);
```

**Why it's bad**: Stale closure bug - effect uses old userId value

---

### Anti-Pattern: Object/Array in Dependencies

**Bad**:
```tsx
function Component({ config }) {
  useEffect(() => {
    // runs every render because config is a new object
    initializeWith(config);
  }, [config]);
}
```

**Good**:
```tsx
function Component({ config }) {
  useEffect(() => {
    initializeWith(config);
  }, [config.key, config.value]); // Use primitive values
}
```

**Why it's bad**: Object references change every render, causing infinite loops

---

### Anti-Pattern: Conditionally Calling Hooks

**Bad**:
```tsx
if (isLoggedIn) {
  const [user, setUser] = useState(null);
}
```

**Good**:
```tsx
const [user, setUser] = useState(null);
// Use user only if isLoggedIn
```

**Why it's bad**: Hooks must be called in the same order every render

---

## Performance Anti-Patterns

### Anti-Pattern: Inline Functions in JSX Props

**Bad**:
```tsx
// Creates new function every render
<MemoizedChild onClick={() => handleClick(id)} />
```

**Good**:
```tsx
const handleChildClick = useCallback(() => handleClick(id), [id]);
<MemoizedChild onClick={handleChildClick} />
```

**Why it's bad**: Breaks memoization of child components

---

_More anti-patterns will be added as they are discovered._
