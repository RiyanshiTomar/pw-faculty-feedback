// Superclass by PhysicsWallah — brand logo.
// White background card with subtle shadow — works cleanly on
// both the dark left panel and light backgrounds.
export default function PWLogo({ height = 32 }) {
  return (
    <div className="pw-logo-badge" style={{ height: height + 14 }}>
      <img src="/logo.png" alt="Superclass by PhysicsWallah" style={{ height }} />
    </div>
  );
}
