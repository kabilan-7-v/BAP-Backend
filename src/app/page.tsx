
export default function Home() {
  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>BAP Backend API</h1>
      <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>Authentication service running on port 3001</p>
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '8px',
        textAlign: 'left'
      }}>
        <h2 style={{ marginBottom: '1rem' }}>Available Endpoints:</h2>
        <ul style={{ listStyle: 'none', padding: 0, lineHeight: 2 }}>
          <li>POST /api/auth/register - Register new user</li>
          <li>POST /api/auth/login - Login user</li>
          <li>POST /api/auth/logout - Logout user</li>
          <li>GET /api/auth/me - Get current user</li>
          <li>POST /api/auth/google - Google OAuth</li>
          <li>GET /api/auth/verify-email - Verify email</li>
          <li>POST /api/auth/resend-verification - Resend verification email</li>
          <li>POST /api/auth/forgot-password - Request password reset</li>
          <li>POST /api/auth/reset-password - Reset password</li>
          <li>GET /api/health - Health check</li>
        </ul>
      </div>
    </main>
  );
}
