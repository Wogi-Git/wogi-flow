# React Successful Patterns

Patterns that have proven to work well in React projects.
These are extracted from successful task completions.

---

## Component Patterns

### Pattern: Functional Components with Hooks

**Context**: All new components
**Example**:
```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  onClick,
  children
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```
**Why it works**: Props destructured with defaults, typed interface, simple functional structure

---

### Pattern: Controlled Form Inputs

**Context**: Form handling
**Example**:
```tsx
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // handle submission
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Login</button>
    </form>
  );
}
```
**Why it works**: Single source of truth, predictable state updates

---

## Hook Patterns

### Pattern: Custom Hook for Data Fetching

**Context**: API data fetching
**Example**:
```tsx
function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}
```
**Why it works**: Handles cleanup, prevents state updates on unmounted component

---

### Pattern: useCallback for Event Handlers

**Context**: Components with child props
**Example**:
```tsx
function Parent() {
  const [count, setCount] = useState(0);

  const handleClick = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  return <Child onClick={handleClick} />;
}
```
**Why it works**: Stable reference prevents unnecessary re-renders of memoized children

---

## State Management Patterns

### Pattern: Lift State Up

**Context**: Shared state between siblings
**Example**:
```tsx
function Parent() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <List onSelect={setSelectedId} selectedId={selectedId} />
      <Detail itemId={selectedId} />
    </>
  );
}
```
**Why it works**: Single source of truth, predictable data flow

---

_More patterns will be added as they are discovered._
