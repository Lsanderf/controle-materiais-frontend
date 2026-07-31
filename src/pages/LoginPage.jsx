import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ErrorMessage } from '../components/Feedback';
import { useAuth } from '../context/useAuth';

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'Entrar | Controle de materiais';
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({
        username: form.username.trim(),
        password: form.password,
      });
      const destination = location.state?.from?.pathname ?? '/dashboard';
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="brand login-brand">
          <span className="brand-mark">CM</span>
          <span>
            <strong>Controle</strong>
            <small>de materiais</small>
          </span>
        </div>
        <div>
          <span className="eyebrow light">Estoque sob controle</span>
          <h1>Materiais no lugar certo, na hora certa.</h1>
          <p>
            Registre entradas, retiradas e devoluções em uma experiência simples
            e segura.
          </p>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div>
            <span className="eyebrow">Acesso ao sistema</span>
            <h2>Boas-vindas</h2>
            <p>Informe seus dados para continuar.</p>
          </div>

          <ErrorMessage error={error} />

          <label className="field">
            <span>Usuário</span>
            <input
              autoComplete="username"
              autoFocus
              required
              value={form.username}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
              placeholder="Seu usuário"
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Sua senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </span>
          </label>

          <button
            type="submit"
            className="button button-primary button-large"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner small" aria-hidden="true" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
          <small className="login-help">
            As credenciais são fornecidas pelo administrador do sistema.
          </small>
        </form>
      </section>
    </main>
  );
}
